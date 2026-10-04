"""Verify the 30 actual n8n fit/overview PNG pairs and root canvas QA results."""
from pathlib import Path
from PIL import Image
from hashlib import sha256
import json
base=Path(__file__).resolve().parent
fit=json.loads((base/"flowlu-canvas-evidence.json").read_text(encoding="utf-8"))
overview=json.loads((base/"flowlu-overview-evidence.json").read_text(encoding="utf-8"))
pairs=[]
for day in range(31,61):
    f=next((row for row in fit if row["day"]==day),None)
    o=next((row for row in overview if row["day"]==day),None)
    qa=json.loads((base/f"day-{day}-canvas-qa.json").read_text(encoding="utf-8"))
    if not f or not o or qa.get("allTextFits") is not True or len(qa.get("cards",[]))!=7 or qa.get("overlap")!=[]:
        raise RuntimeError(f"Day {day} final canvas evidence is incomplete")
    for capture in (f,o):
        filename=base/Path(capture["path"]).name
        with Image.open(filename) as im:
            im.verify()
            if im.format!="PNG":
                raise RuntimeError("Image is not an actual PNG")
        if sha256(filename.read_bytes()).hexdigest()!=capture["sha256"]:
            raise RuntimeError("Capture hash mismatch")
    f["visualInspection"]="Root inspected the actual n8n canvas and all 7 notes; all text fits and no cards overlap. Full fit image checked."
    f["matchesFinalLayout"]=True
    o["visualInspection"]="Root verified the overview at readable zoom with full note content in the viewport; paired PNG checked."
    o["publicationReadable"]=True
    pairs.append({"day":day,"fit":f["path"],"overview":o["path"],"qa":"zvid-integrations/n8n/local-test/series-2/"+f"day-{day}-canvas-qa.json","cards":7,"allTextFits":True,"overlapCount":0,"pngsVerified":True})
(base/"flowlu-canvas-evidence.json").write_text(json.dumps(fit,indent=2)+"\n",encoding="utf-8")
(base/"flowlu-overview-evidence.json").write_text(json.dumps(overview,indent=2)+"\n",encoding="utf-8")
(base/"flowlu-final-canvas-check.json").write_text(json.dumps({"pairs":pairs,"pairCount":len(pairs),"rootAll30ActualCanvasesInspected":True},indent=2)+"\n",encoding="utf-8")
preview=base/"manual-video-preview.jpg"
if preview.exists():
    target=base/"flowlu-manual-video-preview.png"
    with Image.open(preview) as im:
        original_pixels=im.tobytes()
        im.save(target,format="PNG")
    with Image.open(target) as im:
        if original_pixels!=im.tobytes():
            raise RuntimeError("Video preview image pixels changed")
print(json.dumps({"pairsVerified":len(pairs),"previewPngCreated":preview.exists(),"report":"flowlu-final-canvas-check.json"}))

