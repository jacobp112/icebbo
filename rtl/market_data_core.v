`timescale 1ns/1ps
`default_nettype none

module market_data_core (
    input  wire        clk,
    input  wire        rst,
    input  wire        byte_valid,
    output wire        byte_ready,
    input  wire [7:0]  byte_data,
    output wire        bid_valid,
    output wire [31:0] best_bid,
    output wire        ask_valid,
    output wire [31:0] best_ask
);
    wire        candidate_valid;
    wire        candidate_ready;
    wire        candidate_side;
    wire [31:0] candidate_price;

    frame_parser parser (
        .clk(clk),
        .rst(rst),
        .byte_valid(byte_valid),
        .byte_ready(byte_ready),
        .byte_data(byte_data),
        .candidate_valid(candidate_valid),
        .candidate_ready(candidate_ready),
        .candidate_side(candidate_side),
        .candidate_price(candidate_price)
    );

    candidate_bbo bbo (
        .clk(clk),
        .rst(rst),
        .candidate_valid(candidate_valid),
        .candidate_ready(candidate_ready),
        .candidate_side(candidate_side),
        .candidate_price(candidate_price),
        .bid_valid(bid_valid),
        .best_bid(best_bid),
        .ask_valid(ask_valid),
        .best_ask(best_ask)
    );
endmodule

`default_nettype wire
