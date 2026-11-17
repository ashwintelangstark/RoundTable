"""
RoundTable OpenCV Real-Time Facial Expression & Behavioral Telemetry Worker.

Reads line-delimited JSON requests from stdin:
  {"id": "...", "image": "data:image/jpeg;base64,..."}
Writes line-delimited JSON responses to stdout with normalized face/eye boxes,
expression classification, eye contact, composure, and engagement scores.
"""

import base64
import json
import os
import sys
import numpy as np
import cv2

CASCADE_DIR = cv2.data.haarcascades
FACE_CASCADE = cv2.CascadeClassifier(os.path.join(CASCADE_DIR, "haarcascade_frontalface_default.xml"))
FACE_ALT_CASCADE = cv2.CascadeClassifier(os.path.join(CASCADE_DIR, "haarcascade_frontalface_alt2.xml"))
PROFILE_CASCADE = cv2.CascadeClassifier(os.path.join(CASCADE_DIR, "haarcascade_profileface.xml"))
EYE_CASCADE = cv2.CascadeClassifier(os.path.join(CASCADE_DIR, "haarcascade_eye_tree_eyeglasses.xml"))
SMILE_CASCADE = cv2.CascadeClassifier(os.path.join(CASCADE_DIR, "haarcascade_smile.xml"))

prev_face_gray = None
prev_center = None


def decode_frame(data_url: str):
    if "," in data_url:
        _, b64 = data_url.split(",", 1)
    else:
        b64 = data_url
    raw = base64.b64decode(b64)
    arr = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img


def analyze_frame(img):
    global prev_face_gray, prev_center

    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    norm = clahe.apply(gray)

    faces = FACE_CASCADE.detectMultiScale(norm, scaleFactor=1.15, minNeighbors=5, minSize=(48, 48))
    if len(faces) == 0:
        faces = FACE_ALT_CASCADE.detectMultiScale(norm, scaleFactor=1.15, minNeighbors=4, minSize=(48, 48))

    is_profile = False
    if len(faces) == 0:
        profiles = PROFILE_CASCADE.detectMultiScale(norm, scaleFactor=1.15, minNeighbors=4, minSize=(48, 48))
        if len(profiles) == 0:
            profiles = PROFILE_CASCADE.detectMultiScale(cv2.flip(norm, 1), scaleFactor=1.15, minNeighbors=4, minSize=(48, 48))
            if len(profiles) > 0:
                px, py, pw, ph = profiles[0]
                faces = np.array([[w - px - pw, py, pw, ph]])
                is_profile = True
        else:
            faces = profiles
            is_profile = True

    if len(faces) == 0:
        prev_face_gray = None
        prev_center = None
        return {
            "face_detected": False,
            "expression": "No Face Detected",
            "eye_contact_score": 0.0,
            "smile_score": 0.0,
            "composure_score": 35.0,
            "engagement_score": 20.0,
            "head_offset_x": 0.0,
            "head_offset_y": 0.0,
            "face_box": None,
            "eyes": [],
            "smile_detected": False,
            "lighting_ok": float(np.mean(gray)) > 40.0,
        }

    # Pick largest detected face
    fx, fy, fw, fh = max(faces, key=lambda r: r[2] * r[3])
    fx, fy, fw, fh = int(fx), int(fy), int(fw), int(fh)

    roi_upper = norm[fy : fy + int(fh * 0.62), fx : fx + fw]
    roi_lower = norm[fy + int(fh * 0.52) : fy + fh, fx : fx + fw]

    eyes = EYE_CASCADE.detectMultiScale(roi_upper, scaleFactor=1.12, minNeighbors=4, minSize=(14, 14))
    smiles = SMILE_CASCADE.detectMultiScale(roi_lower, scaleFactor=1.4, minNeighbors=16, minSize=(22, 14))

    center_x = (fx + fw / 2.0) / float(w)
    center_y = (fy + fh / 2.0) / float(h)
    offset_x = round((center_x - 0.5) * 2.0, 3)  # -1..1
    offset_y = round((center_y - 0.5) * 2.0, 3)  # -1..1

    # Temporal motion & composure stability inside normalized 64x64 face patch
    face_patch = cv2.resize(norm[fy : fy + fh, fx : fx + fw], (64, 64))
    motion_penalty = 0.0
    if prev_face_gray is not None and prev_center is not None:
        diff = float(np.mean(cv2.absdiff(face_patch, prev_face_gray)))
        center_shift = float(np.hypot(center_x - prev_center[0], center_y - prev_center[1]))
        motion_penalty = min(45.0, diff * 0.65 + center_shift * 140.0)
    prev_face_gray = face_patch
    prev_center = (center_x, center_y)

    # Compute meaningful behavioral scores
    centering_penalty = min(38.0, (abs(offset_x) * 42.0 + abs(offset_y) * 28.0))
    eye_base = 88.0 if len(eyes) >= 2 else (68.0 if len(eyes) == 1 else 45.0)
    if is_profile:
        eye_base = min(eye_base, 36.0)
    eye_contact_score = round(max(12.0, min(99.0, eye_base - centering_penalty * 0.55)), 1)

    smile_detected = len(smiles) > 0
    smile_score = round(min(96.0, 74.0 + min(len(smiles), 3) * 7.0) if smile_detected else 28.0, 1)

    composure_score = round(max(25.0, min(98.0, 92.0 - motion_penalty - (12.0 if is_profile else 0.0))), 1)
    engagement_score = round(
        max(
            20.0,
            min(
                99.0,
                eye_contact_score * 0.50 + composure_score * 0.35 + (14.0 if smile_detected else 6.0),
            ),
        ),
        1,
    )

    if is_profile or abs(offset_x) > 0.38:
        expression = "Looking Away"
    elif smile_detected:
        expression = "Warm & Engaged"
    elif len(eyes) >= 2 and composure_score >= 76.0:
        expression = "Composed & Attentive"
    elif motion_penalty > 24.0:
        expression = "Restless / Animated"
    else:
        expression = "Thoughtful & Focused"

    norm_eyes = [
        {
            "x": round((fx + int(ex)) / float(w), 4),
            "y": round((fy + int(ey)) / float(h), 4),
            "w": round(int(ew) / float(w), 4),
            "h": round(int(eh) / float(h), 4),
        }
        for (ex, ey, ew, eh) in eyes[:2]
    ]

    return {
        "face_detected": True,
        "expression": expression,
        "eye_contact_score": eye_contact_score,
        "smile_score": smile_score,
        "composure_score": composure_score,
        "engagement_score": engagement_score,
        "head_offset_x": offset_x,
        "head_offset_y": offset_y,
        "face_box": {
            "x": round(fx / float(w), 4),
            "y": round(fy / float(h), 4),
            "w": round(fw / float(w), 4),
            "h": round(fh / float(h), 4),
        },
        "eyes": norm_eyes,
        "smile_detected": smile_detected,
        "lighting_ok": float(np.mean(gray)) > 40.0,
    }


def main():
    sys.stdout.write(json.dumps({"ready": True, "opencv": cv2.__version__}) + "\n")
    sys.stdout.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        req_id = None
        try:
            payload = json.loads(line)
            req_id = payload.get("id")
            img = decode_frame(payload["image"])
            if img is None:
                raise ValueError("Could not decode JPEG frame")
            result = analyze_frame(img)
            sys.stdout.write(json.dumps({"id": req_id, "ok": True, "data": result}) + "\n")
        except Exception as exc:
            sys.stdout.write(json.dumps({"id": req_id, "ok": False, "error": str(exc)}) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
