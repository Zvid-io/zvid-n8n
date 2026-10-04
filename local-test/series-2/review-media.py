"""Inspect MP4s produced by this task's successful manual n8n executions.

Downloads only completed synthetic outputs recorded in executions.json. URLs are
never printed or written to the QA report. Cached files are reused when the same
execution is reviewed again. Representative frames include every rendered scene.
"""

import argparse
import hashlib
import json
import math
import re
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageStat


BASE = Path(__file__).resolve().parent
MEDIA = BASE / "media"
FFMPEG = Path("C:/ffmpeg/bin/ffmpeg.exe")
FFPROBE = Path("C:/ffmpeg/bin/ffprobe.exe")
REPORT = BASE / "media-results.json"


def run_command(command):
    result = subprocess.run(command, capture_output=True, text=True, timeout=120)
    if result.returncode:
        raise RuntimeError("Media inspection command failed with exit code " + str(result.returncode))
    return result.stdout


def atomic_json(path, value):
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2), encoding="utf-8")
    temporary.replace(path)


def font(size):
    try:
        return ImageFont.truetype("C:/Windows/Fonts/arial.ttf", size)
    except OSError:
        return ImageFont.load_default()


def contact_sheet(day, frames, output):
    cell_width, cell_height, caption_height = 768, 432, 44
    columns = 2
    rows = math.ceil(len(frames) / columns)
    sheet = Image.new("RGB", (columns * cell_width, rows * (cell_height + caption_height)), "#1b2328")
    draw = ImageDraw.Draw(sheet)
    for index, frame in enumerate(frames):
        x, y = (index % columns) * cell_width, (index // columns) * (cell_height + caption_height)
        with Image.open(MEDIA / frame["file"]) as source:
            thumb = source.convert("RGB").resize((cell_width, cell_height), Image.Resampling.LANCZOS)
            sheet.paste(thumb, (x, y + caption_height))
        draw.text((x + 14, y + 10), f"Day {day} / {frame['scene']} / {frame['seconds']:.1f}s", font=font(22), fill="#f5f2e8")
    sheet.save(output)


def copy_watch_binary(execution, destination):
    preview = execution.get("preview") or {}
    binary_id = preview.get("id") or ""
    match = re.fullmatch(r"filesystem-v2:(workflows/(ZvidSeries2Day\d+)/executions/(\d+)/binary_data/[a-f0-9-]{36})", binary_id)
    if not match or match.group(2) != execution.get("workflowId") or int(match.group(3)) != int(execution.get("id")):
        return False
    if preview.get("mimeType") != "video/mp4":
        return False
    source = "n8n:/home/node/.n8n/storage/" + match.group(1)
    result = subprocess.run(["docker", "cp", source, str(destination)], capture_output=True, text=True, timeout=30)
    return result.returncode == 0 and destination.exists() and destination.stat().st_size > 5000


def inspect(execution, prefer_binary=False):
    output = execution.get("output") or {}
    match = re.fullmatch(r"ZvidSeries2Day(\d+)", str(execution.get("workflowId", "")))
    if not match:
        raise ValueError("Unexpected workflow identity")
    day = int(match.group(1))
    if not 31 <= day <= 60:
        raise ValueError("Day is outside this task's series")
    url = output.get("videoUrl")
    parsed = urllib.parse.urlsplit(url or "")
    if parsed.scheme != "https" or parsed.hostname != "cdn.zvid.io" or not parsed.path.endswith(".mp4") or parsed.username or parsed.password:
        raise ValueError("Completed media URL is outside the task output CDN allow-list")
    seconds = output.get("seconds")
    if not isinstance(seconds, (int, float)) or not math.isfinite(seconds) or seconds <= 0:
        raise ValueError("Expected duration is missing or invalid")
    destination = MEDIA / f"day-{day:02d}.mp4"
    stamp = MEDIA / f"day-{day:02d}.execution.json"
    execution_id = execution.get("id")
    previous = json.loads(stamp.read_text(encoding="utf-8")) if stamp.exists() else {}
    media_source = previous.get("source", "completed-video-url")
    if not destination.exists() or previous.get("executionId") != execution_id:
        request = urllib.request.Request(url, headers={"User-Agent": "ZvidWorkflowMediaQA/1.0"})
        temporary = destination.with_suffix(".mp4.part")
        maximum = 64 * 1024 * 1024
        binary_copied = prefer_binary and copy_watch_binary(execution, temporary)
        if binary_copied:
            media_source = "n8n-watch-binary"
        else:
            media_source = "completed-video-url"
            for attempt in range(3):
                downloaded = 0
                try:
                    with urllib.request.urlopen(request, timeout=20) as response, temporary.open("wb") as handle:
                        while True:
                            chunk = response.read(256 * 1024)
                            if not chunk:
                                break
                            downloaded += len(chunk)
                            if downloaded > maximum:
                                raise ValueError("Media exceeds the QA download limit")
                            handle.write(chunk)
                    break
                except (urllib.error.URLError, TimeoutError):
                    if attempt == 2:
                        raise
        temporary.replace(destination)
        atomic_json(stamp, {"executionId": execution_id, "workflowId": execution["workflowId"], "source": media_source})
    probe = json.loads(run_command([str(FFPROBE), "-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height", "-of", "json", str(destination)]))
    video = next((stream for stream in probe.get("streams", []) if stream.get("codec_type") == "video"), {})
    duration = float(probe.get("format", {}).get("duration", 0))
    resolution_ok = video.get("width") == 1280 and video.get("height") == 720
    duration_ok = abs(duration - seconds) <= 0.2
    run_command([str(FFMPEG), "-hide_banner", "-loglevel", "error", "-xerror", "-i", str(destination), "-map", "0:v:0", "-f", "null", "-"])
    brief = output.get("brief") or {}
    cards = brief.get("cards") or []
    detail_pages = math.ceil(len(cards) / 3)
    scene_count = 2 + detail_pages
    scene_seconds = seconds / scene_count
    scenes = ["opening"] + [f"details-{index + 1}" for index in range(detail_pages)] + ["closing"]
    frames = []
    for index, scene in enumerate(scenes):
        position = min(duration - 0.1, scene_seconds * (index + 0.5))
        filename = f"day-{day:02d}-{scene}.png"
        target = MEDIA / filename
        run_command([str(FFMPEG), "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{position:.3f}", "-i", str(destination), "-frames:v", "1", str(target)])
        with Image.open(target) as frame:
            deviation = ImageStat.Stat(frame.convert("L")).stddev[0]
        frames.append({"scene": scene, "seconds": position, "file": filename, "lumaStdDev": round(deviation, 2)})
    contact = f"day-{day:02d}-contact.png"
    contact_sheet(day, frames, MEDIA / contact)
    sha256 = hashlib.sha256(destination.read_bytes()).hexdigest()
    return {
        "day": day,
        "executionId": execution_id,
        "workflowId": execution["workflowId"],
        "jobId": output.get("jobId"),
        "file": str(destination.relative_to(BASE)).replace("\\", "/"),
        "bytes": destination.stat().st_size,
        "sha256": sha256,
        "mediaSource": media_source,
        "codec": video.get("codec_name"),
        "width": video.get("width"),
        "height": video.get("height"),
        "expectedSeconds": seconds,
        "actualSeconds": duration,
        "resolutionPassed": resolution_ok,
        "durationPassed": duration_ok,
        "fullDecodePassed": True,
        "sceneCount": scene_count,
        "frames": frames,
        "contactSheet": "media/" + contact,
        "mediaPassed": resolution_ok and duration_ok and destination.stat().st_size > 5000,
        "visualReview": "pending",
        "checkedAt": datetime.now(timezone.utc).isoformat(),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", nargs="*", type=int, help="Inspect only the specified day numbers")
    parser.add_argument("--force", action="store_true", help="Re-extract already inspected executions")
    parser.add_argument("--prefer-binary", action="store_true", help="Copy only this execution's saved n8n Watch binary read-only before trying its CDN URL")
    args = parser.parse_args()
    MEDIA.mkdir(parents=True, exist_ok=True)
    executions_path = BASE / "executions.json"
    if not executions_path.exists():
        print("No saved manual executions are available yet.")
        return
    executions = json.loads(executions_path.read_text(encoding="utf-8-sig"))
    latest = {}
    for execution in executions:
        output = execution.get("output") or {}
        match = re.fullmatch(r"ZvidSeries2Day(\d+)", str(execution.get("workflowId", "")))
        if match and execution.get("mode") == "manual" and execution.get("status") == "success" and output.get("status") == "completed":
            day = int(match.group(1))
            if day not in latest or int(execution["id"]) > int(latest[day]["id"]):
                latest[day] = execution
    existing = json.loads(REPORT.read_text(encoding="utf-8")) if REPORT.exists() else {"results": []}
    results = {item["day"]: item for item in existing.get("results", [])}
    inspected = 0
    for day in sorted(latest):
        if args.days and day not in args.days:
            continue
        previous = results.get(day)
        if previous and previous.get("executionId") == latest[day]["id"] and previous.get("mediaPassed") and not args.force:
            continue
        try:
            results[day] = inspect(latest[day], prefer_binary=args.prefer_binary)
            if previous and previous.get("executionId") == latest[day]["id"]:
                for field in ("visualReview", "visualNotes"):
                    if field in previous:
                        results[day][field] = previous[field]
            inspected += 1
            result = results[day]
            print(f"Day {day}: {result['width']}x{result['height']}, {result['actualSeconds']:.2f}s / expected {result['expectedSeconds']}s, media {'PASS' if result['mediaPassed'] else 'FAIL'}")
        except Exception as error:
            # Error text from URL libraries can contain signed URLs. Report the
            # class and status only, never the exception's complete string.
            failure = {"day": day, "executionId": latest[day]["id"], "mediaPassed": False, "errorType": type(error).__name__, "httpStatus": getattr(error, "code", None), "visualReview": "unavailable"}
            results[day] = failure
            print(f"Day {day}: inspection failed ({failure['errorType']}, HTTP {failure['httpStatus']})")
        atomic_json(REPORT, {"updatedAt": datetime.now(timezone.utc).isoformat(), "manualCompletedAvailable": len(latest), "results": [results[key] for key in sorted(results)]})
    print(f"Media records: {len(results)}; newly inspected: {inspected}.")


if __name__ == "__main__":
    main()
