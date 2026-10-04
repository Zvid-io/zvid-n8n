"""Preserve actual browser captures and normalize their file encoding to PNG."""
from pathlib import Path
from PIL import Image
from hashlib import sha256
import json

base = Path(__file__).resolve().parent
previous_path = base / "flowlu-canvas-evidence.json"
previous = json.loads(previous_path.read_text(encoding="utf-8")) if previous_path.exists() else []
previous_by_day = {record["day"]: record for record in previous}
records = []
for day in range(31, 61):
    original = base / f"day-{day}-canvas.png"
    if not original.exists():
        continue
    output = base / f"flowlu-day-{day}-canvas.png"
    with Image.open(original) as image:
        source_format = image.format
        dimensions = image.size
        original_pixels = image.tobytes()
        image.save(output, format="PNG")
    with Image.open(output) as encoded:
        if encoded.tobytes() != original_pixels:
            raise RuntimeError("PNG normalization changed image pixels")
    output_hash = sha256(output.read_bytes()).hexdigest()
    prior = previous_by_day.get(day, {})
    records.append({
        "day": day,
        "source": original.name,
        "sourceFormat": source_format,
        "path": "zvid-integrations/n8n/local-test/series-2/" + output.name,
        "format": "PNG",
        "width": dimensions[0],
        "height": dimensions[1],
        "bytes": output.stat().st_size,
        "sha256": output_hash,
        "pixelContentChanged": False,
        "visualInspection": prior.get("visualInspection", "Pending") if prior.get("sha256") == output_hash else "Pending",
        "publicationReadable": prior.get("publicationReadable", False) if prior.get("sha256") == output_hash else False,
        "matchesFinalLayout": prior.get("matchesFinalLayout", False) if prior.get("sha256") == output_hash else False,
    })
(base / "flowlu-canvas-evidence.json").write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
overview_previous_path = base / "flowlu-overview-evidence.json"
overview_previous = json.loads(overview_previous_path.read_text(encoding="utf-8")) if overview_previous_path.exists() else []
overview_previous_by_day = {record["day"]: record for record in overview_previous}
overviews = []
for day in range(31, 61):
    original = base / f"day-{day}-overview.jpg"
    if not original.exists():
        continue
    output = base / f"flowlu-day-{day}-overview.png"
    with Image.open(original) as image:
        source_format = image.format
        dimensions = image.size
        original_pixels = image.tobytes()
        image.save(output, format="PNG")
    with Image.open(output) as encoded:
        if encoded.tobytes() != original_pixels:
            raise RuntimeError("Overview PNG normalization changed image pixels")
    output_hash = sha256(output.read_bytes()).hexdigest()
    prior = overview_previous_by_day.get(day, {})
    overviews.append({
        "day": day,
        "source": original.name,
        "sourceFormat": source_format,
        "path": "zvid-integrations/n8n/local-test/series-2/" + output.name,
        "format": "PNG",
        "width": dimensions[0],
        "height": dimensions[1],
        "bytes": output.stat().st_size,
        "sha256": output_hash,
        "pixelContentChanged": False,
        "visualInspection": prior.get("visualInspection", "Pending") if prior.get("sha256") == output_hash else "Pending",
        "publicationReadable": prior.get("publicationReadable", False) if prior.get("sha256") == output_hash else False,
    })
(base / "flowlu-overview-evidence.json").write_text(json.dumps(overviews, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"fitCaptures": len(records), "fitDays": [row["day"] for row in records], "overviewCaptures": len(overviews), "overviewDays": [row["day"] for row in overviews]}))
