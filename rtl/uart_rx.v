`timescale 1ns/1ps
`default_nettype none

// 8N1 receiver. CLKS_PER_BIT must be an integer from 4 through 255.
module uart_rx #(
    parameter integer CLKS_PER_BIT = 16
) (
    input  wire       clk,
    input  wire       rst,
    input  wire       rx,
    output reg        byte_valid,
    output reg [7:0]  byte_data,
    output reg        framing_error
);
    localparam [1:0] IDLE = 2'd0, START = 2'd1,
                     DATA = 2'd2, STOP = 2'd3;

    reg rx_meta;
    reg rx_sync;
    reg [1:0] state;
    reg [7:0] clocks_left;
    reg [2:0] bit_index;
    reg [7:0] shift_data;

    always @(posedge clk) begin
        if (rst) begin
            rx_meta       <= 1'b1;
            rx_sync       <= 1'b1;
            state         <= IDLE;
            clocks_left   <= 8'd0;
            bit_index     <= 3'd0;
            shift_data    <= 8'd0;
            byte_valid    <= 1'b0;
            byte_data     <= 8'd0;
            framing_error <= 1'b0;
        end else begin
            rx_meta       <= rx;
            rx_sync       <= rx_meta;
            byte_valid    <= 1'b0;
            framing_error <= 1'b0;

            case (state)
                IDLE: if (!rx_sync) begin
                    clocks_left <= (CLKS_PER_BIT / 2) - 1;
                    state <= START;
                end
                START: if (clocks_left == 0) begin
                    if (!rx_sync) begin
                        clocks_left <= CLKS_PER_BIT - 1;
                        bit_index <= 3'd0;
                        state <= DATA;
                    end else begin
                        state <= IDLE;
                    end
                end else clocks_left <= clocks_left - 8'd1;
                DATA: if (clocks_left == 0) begin
                    shift_data[bit_index] <= rx_sync;
                    clocks_left <= CLKS_PER_BIT - 1;
                    if (bit_index == 3'd7)
                        state <= STOP;
                    else
                        bit_index <= bit_index + 3'd1;
                end else clocks_left <= clocks_left - 8'd1;
                STOP: if (clocks_left == 0) begin
                    state <= IDLE;
                    if (rx_sync) begin
                        byte_data <= shift_data;
                        byte_valid <= 1'b1;
                    end else begin
                        framing_error <= 1'b1;
                    end
                end else clocks_left <= clocks_left - 8'd1;
                default: state <= IDLE;
            endcase
        end
    end
endmodule

`default_nettype wire
