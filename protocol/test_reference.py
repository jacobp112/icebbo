import json
import unittest
from pathlib import Path

from build_vectors import build
from reference import ASK, BID, BboState, StreamDecoder, crc8, decode_frame, encode_frame


class ProtocolTests(unittest.TestCase):
    def test_saved_vectors_are_current_and_match_reference(self) -> None:
        saved = json.loads(Path(__file__).with_name("vectors.json").read_text())
        self.assertEqual(saved, build())
        model = BboState()
        parser = StreamDecoder()
        for vector in saved["vectors"]:
            with self.subTest(vector=vector["name"]):
                if vector["action"] == "reset":
                    parser.reset()
                    model.reset()
                else:
                    candidate = None
                    for byte in bytes.fromhex(vector["frame_hex"]):
                        emitted = parser.push(byte)
                        if emitted is not None:
                            candidate = emitted
                    self.assertEqual(candidate is not None, vector["accepted"])
                    if candidate is not None:
                        model.apply(*candidate)
                self.assertEqual(model.snapshot(), vector["expect"])

    def test_crc_and_byte_order(self) -> None:
        frame = encode_frame(BID, 0x12345678)
        self.assertEqual(frame[:6], bytes.fromhex("A51012345678"))
        self.assertEqual(frame[-1], crc8(bytes.fromhex("A51012345678")))
        self.assertEqual(decode_frame(frame), (BID, 0x12345678))

    def test_idle_noise_truncation_and_reset(self) -> None:
        parser = StreamDecoder()
        frame = encode_frame(ASK, 7)
        for byte in b"\x00\x11\xff":
            self.assertIsNone(parser.push(byte))
        for byte in frame[:4]:
            self.assertIsNone(parser.push(byte))
        parser.reset()
        for byte in frame[:-1]:
            self.assertIsNone(parser.push(byte))
        self.assertEqual(parser.push(frame[-1]), (ASK, 7))

    def test_out_of_range_values_rejected(self) -> None:
        for value in (-1, 0x100000000):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    encode_frame(BID, value)
        with self.assertRaises(ValueError):
            StreamDecoder().push(256)


if __name__ == "__main__":
    unittest.main()
