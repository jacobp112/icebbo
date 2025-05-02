"""Generate and check deterministic shared vectors from hand-set expectations."""

import argparse
import json
from pathlib import Path

from reference import ASK, BID, BboState, decode_frame, encode_frame

VECTOR_PATH = Path(__file__).with_name("vectors.json")


def state(bid_valid: bool, bid: int, ask_valid: bool, ask: int) -> dict:
    return {
        "bid_valid": bid_valid,
        "best_bid": bid,
        "ask_valid": ask_valid,
        "best_ask": ask,
    }


# Expected values are literal test oracles; the model is checked against them.
CASES = [
    ("reset", "reset", None, state(False, 0, False, 0)),
    ("first_bid", "bid", 100, state(True, 100, False, 0)),
    ("first_ask", "ask", 200, state(True, 100, True, 200)),
    ("better_bid", "bid", 110, state(True, 110, True, 200)),
    ("worse_bid", "bid", 90, state(True, 110, True, 200)),
    ("equal_bid", "bid", 110, state(True, 110, True, 200)),
    ("better_ask", "ask", 190, state(True, 110, True, 190)),
    ("worse_ask", "ask", 210, state(True, 110, True, 190)),
    ("equal_ask", "ask", 190, state(True, 110, True, 190)),
    ("bad_crc", "bad_crc", 0xFFFFFFFF, state(True, 110, True, 190)),
    ("bad_control", "bad_control", 99, state(True, 110, True, 190)),
    ("zero_bid_is_worse", "bid", 0, state(True, 110, True, 190)),
    ("max_ask_is_worse", "ask", 0xFFFFFFFF, state(True, 110, True, 190)),
    ("back_to_back_bid_1", "bid", 120, state(True, 120, True, 190)),
    ("back_to_back_bid_2", "bid", 130, state(True, 130, True, 190)),
    ("marker_in_price", "bid", 0xA5000001, state(True, 0xA5000001, True, 190)),
    ("reset_again", "reset", None, state(False, 0, False, 0)),
    ("first_zero_ask", "ask", 0, state(False, 0, True, 0)),
    ("first_max_bid", "bid", 0xFFFFFFFF, state(True, 0xFFFFFFFF, True, 0)),
    ("min_bid_is_worse", "bid", 0, state(True, 0xFFFFFFFF, True, 0)),
    ("max_ask_is_worse_again", "ask", 0xFFFFFFFF, state(True, 0xFFFFFFFF, True, 0)),
]


def build() -> dict:
    model = BboState()
    vectors = []
    for name, kind, price, expected in CASES:
        if kind == "reset":
            model.reset()
            entry = {"name": name, "action": "reset", "expect": expected}
        else:
            control = {"bid": BID, "ask": ASK, "bad_crc": BID,
                       "bad_control": 0x12}[kind]
            frame = encode_frame(control, price)
            if kind == "bad_crc":
                frame = frame[:-1] + bytes((frame[-1] ^ 0x01,))
            decoded = decode_frame(frame)
            if decoded is not None:
                model.apply(*decoded)
            entry = {
                "name": name,
                "action": "frame",
                "frame_hex": frame.hex().upper(),
                "accepted": decoded is not None,
                "expect": expected,
            }
        if model.snapshot() != expected:
            raise AssertionError(f"reference disagrees with oracle for {name}")
        vectors.append(entry)
    return {"format": 1, "protocol": "candidate-price-v1", "vectors": vectors}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="compare with saved vectors")
    args = parser.parse_args()
    data = json.dumps(build(), indent=2) + "\n"
    if args.check:
        if not VECTOR_PATH.exists() or VECTOR_PATH.read_text(encoding="utf-8") != data:
            raise SystemExit("vectors.json is missing or stale")
        print(f"checked {len(CASES)} deterministic vectors")
    else:
        VECTOR_PATH.write_text(data, encoding="utf-8")
        print(f"wrote {len(CASES)} deterministic vectors to {VECTOR_PATH}")


if __name__ == "__main__":
    main()
