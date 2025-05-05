"""Convert the saved protocol vectors into Icarus-readable memory files."""

import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()

    vectors_path = Path(__file__).resolve().parents[1] / "protocol" / "vectors.json"
    document = json.loads(vectors_path.read_text(encoding="utf-8"))
    if document["format"] != 1 or document["protocol"] != "candidate-price-v1":
        raise ValueError("unsupported vector format")

    actions = []
    frames = []
    accepted = []
    expected = []
    for vector in document["vectors"]:
        is_frame = vector["action"] == "frame"
        if not is_frame and vector["action"] != "reset":
            raise ValueError(f"unsupported action: {vector['action']}")
        actions.append("1" if is_frame else "0")
        frame = vector["frame_hex"] if is_frame else "00000000000000"
        if len(frame) != 14:
            raise ValueError(f"frame length in {vector['name']}")
        frames.append(frame)
        accepted.append("1" if vector.get("accepted", False) else "0")
        state = vector["expect"]
        packed = (
            (int(state["bid_valid"]) << 65)
            | (state["best_bid"] << 33)
            | (int(state["ask_valid"]) << 32)
            | state["best_ask"]
        )
        if packed < 0 or packed >= 1 << 66:
            raise ValueError(f"state out of range in {vector['name']}")
        expected.append(f"{packed:017X}")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    for name, lines in (
        ("actions.mem", actions),
        ("frames.mem", frames),
        ("accepted.mem", accepted),
        ("expected.mem", expected),
    ):
        (args.output_dir / name).write_text("\n".join(lines) + "\n", encoding="ascii")
    print(len(actions))


if __name__ == "__main__":
    main()
