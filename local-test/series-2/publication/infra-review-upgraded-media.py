"""Read-only media QA of current, manually delivered upgraded workflows.

Copies the exact saved Watch binary from Docker. There is no CDN fallback and
no credential access. Retains every reviewed execution, accepted-job execution,
functional fingerprint and frozen project digest. Visual confirmation is separate.
"""
import argparse
import hashlib
import json
import math
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageStat

BASE = Path(__file__).resolve().parent
MEDIA = BASE / "upgraded-media"
REPORT = BASE / "upgraded-media-results.json"
FFMPEG = Path("C:/ffmpeg/bin/ffmpeg.exe")
FFPROBE = Path("C:/ffmpeg/bin/ffprobe.exe")


def command(arguments, timeout=120):
    result = subprocess.run(arguments, capture_output=True, text=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError("Inspection command failed (exit " + str(result.returncode) + ")")
    return result.stdout


def save(value):
    temporary = REPORT.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(value, indent=2), encoding="utf-8")
    temporary.replace(REPORT)


def eligible(attempt):
    outcome, receipt, frozen = (attempt.get(key) or {} for key in ("outcome", "receipt", "frozen"))
    return (attempt.get("mode") == "manual" and attempt.get("status") == "success"
            and attempt.get("functionalMatch") is True and attempt.get("syntheticFixture") is True
            and outcome.get("status") == "delivered" and receipt.get("status") == "delivered"
            and all(outcome.get(key) and outcome.get(key) == receipt.get(key) for key in ("sourceId", "revision", "requestKey", "jobId", "driveFileId"))
            and frozen.get("inputHash") == receipt.get("inputHash")
            and attempt.get("acceptedProjectSha256") == frozen.get("projectSha256"))


def same_retained_media(first, second):
    """A replay can cite an original capture only after every retained ID agrees."""
    if not first or not second or not eligible(first) or not eligible(second):
        return False
    if second.get("submissionExecuted") or second.get("uploadExecuted"):
        return False
    if first.get("workflowId") != second.get("workflowId") or first.get("executionFunctionalHash") != second.get("executionFunctionalHash"):
        return False
    first_outcome, second_outcome = first["outcome"], second["outcome"]
    if not all(isinstance(first_outcome.get(key), str) and first_outcome[key]
               and first_outcome[key] == second_outcome.get(key)
               for key in ("sourceId", "revision", "requestKey", "jobId", "driveFileId", "videoUrl", "driveUrl")):
        return False
    return all(re.fullmatch(r"[a-f0-9]{64}", first["frozen"].get(key) or "")
               and first["frozen"][key] == second["frozen"].get(key)
               for key in ("inputHash", "projectSha256"))


def saved_file_matches(record):
    try:
        file = (BASE / record["file"]).resolve(strict=True)
        file.relative_to(MEDIA.resolve())
        return hashlib.sha256(file.read_bytes()).hexdigest() == record.get("sha256")
    except (KeyError, ValueError, OSError):
        return False


def inspect(attempt):
    day, execution_id = attempt["day"], attempt["id"]
    workflow_id = "ZvidSeries2Day" + str(day)
    if attempt["workflowId"] != workflow_id or not 31 <= day <= 60:
        raise ValueError("Unexpected workflow identity")
    preview = attempt.get("preview") or {}
    match = re.fullmatch(r"filesystem-v2:(workflows/(ZvidSeries2Day\d+)/executions/(\d+)/binary_data/[a-f0-9-]{36})", preview.get("id") or "")
    if not match or match.group(2) != workflow_id or int(match.group(3)) != execution_id or preview.get("mimeType") != "video/mp4":
        raise ValueError("Saved preview does not belong to this execution")
    expected = attempt.get("expectedMedia") or {}
    durations = expected.get("sceneDurations") or []
    if not durations or any(not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0 for value in durations):
        raise ValueError("Frozen project timing is invalid")
    destination = MEDIA / f"day-{day}-execution-{execution_id}.mp4"
    if not destination.exists():
        temporary = destination.with_suffix(".mp4.part")
        command(["docker", "cp", "n8n:/home/node/.n8n/storage/" + match.group(1), str(temporary)], 30)
        if not 5000 < temporary.stat().st_size <= 64 * 1024 * 1024:
            raise ValueError("Saved binary size is invalid")
        temporary.replace(destination)
    probe = json.loads(command([str(FFPROBE), "-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height,avg_frame_rate", "-of", "json", str(destination)]))
    video = next((stream for stream in probe.get("streams", []) if stream.get("codec_type") == "video"), {})
    actual_seconds = float(probe.get("format", {}).get("duration", 0))
    numerator, denominator = video.get("avg_frame_rate", "0/1").split("/")
    actual_frame_rate = float(numerator) / float(denominator)
    resolution_passed = video.get("width") == expected.get("width") and video.get("height") == expected.get("height")
    duration_passed = abs(actual_seconds - sum(durations)) <= 0.2
    frame_rate_passed = abs(actual_frame_rate - expected.get("frameRate", 0)) <= 0.05
    command([str(FFMPEG), "-hide_banner", "-loglevel", "error", "-xerror", "-i", str(destination), "-map", "0:v:0", "-f", "null", "-"])
    frames, elapsed = [], 0
    for index, duration in enumerate(durations):
        seconds = min(actual_seconds - 0.1, elapsed + duration / 2)
        elapsed += duration
        scene = "opening" if index == 0 else "closing" if index == len(durations) - 1 else "details-" + str(index)
        file_name = f"day-{day}-execution-{execution_id}-{scene}.png"
        target = MEDIA / file_name
        command([str(FFMPEG), "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{seconds:.3f}", "-i", str(destination), "-frames:v", "1", str(target)])
        with Image.open(target) as frame:
            deviation = ImageStat.Stat(frame.convert("L")).stddev[0]
        frames.append({"scene": scene, "seconds": seconds, "file": "upgraded-media/" + file_name, "lumaStdDev": round(deviation, 2)})
    cell_width, cell_height, caption = 768, 432, 42
    sheet = Image.new("RGB", (cell_width * 2, math.ceil(len(frames) / 2) * (cell_height + caption)), "#1b2328")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 22)
    for index, item in enumerate(frames):
        x, y = index % 2 * cell_width, index // 2 * (cell_height + caption)
        with Image.open(BASE / item["file"]) as frame:
            sheet.paste(frame.convert("RGB").resize((cell_width, cell_height), Image.Resampling.LANCZOS), (x, y + caption))
        draw.text((x + 12, y + 8), f"Day {day} / {item['scene']} / {item['seconds']:.1f}s", fill="white", font=font)
    contact = MEDIA / f"day-{day}-execution-{execution_id}-contact.png"
    sheet.save(contact)
    technical_passed = (resolution_passed and duration_passed and frame_rate_passed
                        and video.get("codec_name") == "h264" and all(frame["lumaStdDev"] > 1 for frame in frames))
    return {"day": day, "workflowId": workflow_id, "executionId": execution_id,
            "acceptedExecutionId": attempt["acceptedExecutionId"], "jobId": attempt["outcome"]["jobId"],
            "functionalHash": attempt["executionFunctionalHash"], "projectSha256": attempt["frozen"]["projectSha256"],
            "inputHash": attempt["frozen"]["inputHash"], "driveFileId": attempt["outcome"]["driveFileId"],
            "file": destination.relative_to(BASE).as_posix(), "mediaSource": "exact-n8n-watch-binary",
            "bytes": destination.stat().st_size, "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
            "codec": video.get("codec_name"), "width": video.get("width"), "height": video.get("height"),
            "expectedSeconds": sum(durations), "actualSeconds": actual_seconds, "actualFrameRate": actual_frame_rate,
            "resolutionPassed": resolution_passed, "durationPassed": duration_passed, "frameRatePassed": frame_rate_passed,
            "fullDecodePassed": True, "sceneCount": len(frames), "frames": frames,
            "contactSheet": contact.relative_to(BASE).as_posix(), "technicalPassed": technical_passed,
            "mediaPassed": technical_passed, "visualReview": "pending", "passed": False,
            "checkedAt": datetime.now(timezone.utc).isoformat()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", nargs="*", type=int)
    parser.add_argument("--mark-visual", nargs="*", type=int, help="Confirm already inspected contact sheets for these exact current executions")
    args = parser.parse_args()
    MEDIA.mkdir(parents=True, exist_ok=True)
    native = json.loads((BASE / "upgraded-executions.json").read_text(encoding="utf-8-sig"))
    previous = json.loads(REPORT.read_text(encoding="utf-8-sig")) if REPORT.exists() else {"results": []}
    results = {item["executionId"]: item for item in previous.get("results", [])}
    accepted = [attempt for attempt in native["attempts"] if eligible(attempt)]
    by_execution = {attempt["id"]: attempt for attempt in accepted}
    reused = 0
    for attempt in accepted:
        day, execution_id = attempt["day"], attempt["id"]
        if args.days and day not in args.days:
            continue
        current = results.get(execution_id)
        if not current:
            original = next((record for record in results.values()
                             if record.get("passed") is True
                             and record.get("technicalPassed") is True
                             and record.get("mediaPassed") is True
                             and record.get("visualReview") == "passed"
                             and same_retained_media(by_execution.get(record["executionId"]), attempt)
                             and saved_file_matches(record)), None)
            if original:
                original["originalMediaCaptureExecutionId"] = original["executionId"]
                original["replayExecutionIds"] = sorted(set(original.get("replayExecutionIds", []) + [execution_id]))
                original["retainedIdentityVerifiedAt"] = datetime.now(timezone.utc).isoformat()
                reused += 1
                save({"updatedAt": datetime.now(timezone.utc).isoformat(), "eligibleManualDeliveries": len(accepted), "results": sorted(results.values(), key=lambda row: (row["day"], row["executionId"]))})
                continue
        if not current or current.get("functionalHash") != attempt["executionFunctionalHash"] or not current.get("technicalPassed"):
            try:
                results[execution_id] = inspect(attempt)
                print(f"Day {day}, execution {execution_id}: technical {'PASS' if results[execution_id]['technicalPassed'] else 'FAIL'}")
            except Exception as error:
                results[execution_id] = {"day": day, "executionId": execution_id, "functionalHash": attempt["executionFunctionalHash"], "jobId": attempt["outcome"]["jobId"], "technicalPassed": False, "mediaPassed": False, "passed": False, "errorType": type(error).__name__, "visualReview": "unavailable"}
                print(f"Day {day}, execution {execution_id}: {type(error).__name__}")
        results[execution_id]["originalMediaCaptureExecutionId"] = execution_id
        if args.mark_visual and day in args.mark_visual and results[execution_id].get("technicalPassed"):
            results[execution_id]["visualReview"] = "passed"
            results[execution_id]["visualReviewedAt"] = datetime.now(timezone.utc).isoformat()
            results[execution_id]["passed"] = True
        save({"updatedAt": datetime.now(timezone.utc).isoformat(), "eligibleManualDeliveries": len(accepted), "results": sorted(results.values(), key=lambda row: (row["day"], row["executionId"]))})
    if reused:
        print(json.dumps({"retainedIdentityReplayExecutions": reused, "originalCaptureIdsPreserved": True}))


if __name__ == "__main__":
    main()
