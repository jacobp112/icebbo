# Candidate-price input protocol, version 1

## Meaning

The stream describes **candidate prices for one instrument**. The state is a running bid maximum and ask minimum since reset. The stream has no deletions or depth. Consequently, these registers cannot reconstruct the next-best quote after a best quote disappears.

Prices are unsigned 32-bit integers in an application-defined integer unit (for example, ticks). No floating-point operation or implied currency scale exists in the wire protocol. Every price from `0x00000000` through `0xFFFFFFFF` is valid. Bid and ask validity are carried by separate output bits; a cleared valid bit means no candidate for that side has been accepted since reset.

## Frame

Each input frame is exactly seven bytes:

| Offset | Field | Encoding |
| ---: | --- | --- |
| 0 | Start marker | `A5` |
| 1 | Control | `10` = bid candidate; `11` = ask candidate |
| 2–5 | Price | Unsigned 32-bit, most significant byte first |
| 6 | CRC-8 | CRC of offsets 0–5; polynomial `07`, initial value `00`, no reflection, final XOR `00` |

For clarity, CRC processing XORs each byte into the 8-bit register, then performs eight left shifts, XORing `0x07` after a shift when the pre-shift top bit was set.

The host sends complete frames in byte order. There is no quantity or instrument identifier. Other control values are reserved and invalid.

## Framing and malformed input

While idle, the parser discards bytes until it sees `A5`. It then consumes exactly six more bytes, regardless of their values. A marker inside the price or CRC is data, not a new frame. At byte 6, a frame with a supported control and matching CRC becomes one candidate; otherwise it is dropped without changing either BBO register. The parser then returns to idle. A truncated frame remains incomplete until its remaining bytes arrive or reset is asserted. There is no timeout in version 1; a transport interruption should reset the parser before a new session. A lost byte can cause one or more frames to be lost before the next idle marker is seen.

This simple framing is adequate for deterministic test traffic but does not promise immediate resynchronisation under arbitrary byte loss. The reference model has the same rules.

## Synchronous boundary and reset

The byte parser produces `candidate_valid`, `candidate_side` and `candidate_price` to the core. A transfer occurs only on a rising edge where `candidate_valid && candidate_ready` is true. The core is designed to accept one candidate on every clock edge after reset; `candidate_ready` is low during reset. The accepted candidate is registered on that edge, then compared and applied at the following rising edge. State outputs are observable after that update edge. RTL simulation will confirm the exact latency and consecutive-transfer behaviour.

`rst` is a synchronous, active-high core reset. It clears both valid bits and both price registers, and flushes any candidate in flight. The UART/frame parser also resets to idle. Board configuration reset and host session reset will be mapped to this synchronous reset during integration.

For a valid bid candidate, update when `!bid_valid || price > best_bid`. For a valid ask candidate, update when `!ask_valid || price < best_ask`. Equal and worse values leave the stored value unchanged. These definitions are the reference for RTL tests.
