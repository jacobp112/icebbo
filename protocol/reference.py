"""Executable reference for the candidate-price input protocol.

This module intentionally has no board, USB, or timing model. It defines only
frame acceptance and the running-extrema state at the core boundary.
"""

from dataclasses import dataclass

SOF = 0xA5
BID = 0x10
ASK = 0x11
FRAME_LEN = 7
MAX_PRICE = 0xFFFFFFFF


def crc8(data: bytes) -> int:
    crc = 0
    for byte in data:
        crc ^= byte
        for _ in range(8):
            crc = ((crc << 1) ^ (0x07 if crc & 0x80 else 0)) & 0xFF
    return crc


def encode_frame(control: int, price: int) -> bytes:
    if not 0 <= control <= 0xFF:
        raise ValueError("control must fit in one byte")
    if not 0 <= price <= MAX_PRICE:
        raise ValueError("price must fit in unsigned 32 bits")
    body = bytes((SOF, control)) + price.to_bytes(4, "big")
    return body + bytes((crc8(body),))


def decode_frame(frame: bytes) -> tuple[int, int] | None:
    if len(frame) != FRAME_LEN or frame[0] != SOF:
        return None
    if frame[1] not in (BID, ASK) or crc8(frame[:6]) != frame[6]:
        return None
    return frame[1], int.from_bytes(frame[2:6], "big")


@dataclass
class BboState:
    bid_valid: bool = False
    best_bid: int = 0
    ask_valid: bool = False
    best_ask: int = 0

    def reset(self) -> None:
        self.bid_valid = False
        self.best_bid = 0
        self.ask_valid = False
        self.best_ask = 0

    def apply(self, control: int, price: int) -> None:
        if control == BID:
            if not self.bid_valid or price > self.best_bid:
                self.best_bid = price
                self.bid_valid = True
        elif control == ASK:
            if not self.ask_valid or price < self.best_ask:
                self.best_ask = price
                self.ask_valid = True
        else:
            raise ValueError("unsupported control")

    def snapshot(self) -> dict[str, bool | int]:
        return {
            "bid_valid": self.bid_valid,
            "best_bid": self.best_bid,
            "ask_valid": self.ask_valid,
            "best_ask": self.best_ask,
        }


class StreamDecoder:
    """Fixed-length framing with idle-only SOF recognition."""

    def __init__(self) -> None:
        self._pending = bytearray()

    def reset(self) -> None:
        self._pending.clear()

    def push(self, byte: int) -> tuple[int, int] | None:
        if not 0 <= byte <= 0xFF:
            raise ValueError("byte must fit in eight bits")
        if not self._pending:
            if byte == SOF:
                self._pending.append(byte)
            return None
        self._pending.append(byte)
        if len(self._pending) < FRAME_LEN:
            return None
        frame = bytes(self._pending)
        self._pending.clear()
        return decode_frame(frame)
