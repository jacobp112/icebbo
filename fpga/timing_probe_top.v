`timescale 1ns/1ps
`default_nettype none

// Temporary synthesis top for the serial input path. It is not the final
// board interface: BBO readback and programming control are still pending.
module timing_probe_top (
    input  wire clk_48mhz,
    input  wire reset_n,
    input  wire uart_rx_pin,
    output wire activity_pin
);
    wire rst = !reset_n;
    wire byte_valid;
    wire [7:0] byte_data;
    wire framing_error;
    wire byte_ready;
    wire bid_valid;
    wire [31:0] best_bid;
    wire ask_valid;
    wire [31:0] best_ask;

    uart_rx #(.CLKS_PER_BIT(16)) receiver (
        .clk(clk_48mhz), .rst(rst), .rx(uart_rx_pin),
        .byte_valid(byte_valid), .byte_data(byte_data),
        .framing_error(framing_error)
    );

    market_data_core core (
        .clk(clk_48mhz), .rst(rst),
        .byte_valid(byte_valid), .byte_ready(byte_ready),
        .byte_data(byte_data), .bid_valid(bid_valid),
        .best_bid(best_bid), .ask_valid(ask_valid), .best_ask(best_ask)
    );

    // This depends on all BBO state bits so synthesis retains the datapath.
    assign activity_pin = bid_valid ^ ask_valid ^
                          (^best_bid) ^ (^best_ask);
endmodule

`default_nettype wire
