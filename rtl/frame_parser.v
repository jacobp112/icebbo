`timescale 1ns/1ps
`default_nettype none

// Fixed seven-byte candidate frame. SOF is recognized only while idle.
module frame_parser (
    input  wire        clk,
    input  wire        rst,
    input  wire        byte_valid,
    output wire        byte_ready,
    input  wire [7:0]  byte_data,
    output reg         candidate_valid,
    input  wire        candidate_ready,
    output reg         candidate_side,
    output reg  [31:0] candidate_price
);
    reg [2:0]  byte_index;
    reg [7:0]  control_byte;
    reg [31:0] price_shift;
    reg [7:0]  frame_crc;

    function [7:0] crc8_next;
        input [7:0] old_crc;
        input [7:0] data;
        reg [7:0] next_crc;
        integer bit_index;
        begin
            next_crc = old_crc ^ data;
            for (bit_index = 0; bit_index < 8; bit_index = bit_index + 1) begin
                if (next_crc[7])
                    next_crc = (next_crc << 1) ^ 8'h07;
                else
                    next_crc = next_crc << 1;
            end
            crc8_next = next_crc;
        end
    endfunction

    assign byte_ready = !rst && (!candidate_valid || candidate_ready);

    always @(posedge clk) begin
        if (rst) begin
            byte_index      <= 3'd0;
            control_byte    <= 8'b0;
            price_shift     <= 32'b0;
            frame_crc       <= 8'b0;
            candidate_valid <= 1'b0;
            candidate_side  <= 1'b0;
            candidate_price <= 32'b0;
        end else begin
            if (candidate_valid && candidate_ready)
                candidate_valid <= 1'b0;

            if (byte_valid && byte_ready) begin
                case (byte_index)
                    3'd0: begin
                        if (byte_data == 8'hA5) begin
                            frame_crc  <= crc8_next(8'h00, byte_data);
                            byte_index <= 3'd1;
                        end
                    end
                    3'd1: begin
                        control_byte <= byte_data;
                        frame_crc    <= crc8_next(frame_crc, byte_data);
                        byte_index   <= 3'd2;
                    end
                    3'd2, 3'd3, 3'd4, 3'd5: begin
                        price_shift <= {price_shift[23:0], byte_data};
                        frame_crc   <= crc8_next(frame_crc, byte_data);
                        byte_index  <= byte_index + 3'd1;
                    end
                    3'd6: begin
                        byte_index <= 3'd0;
                        if (byte_data == frame_crc &&
                            (control_byte == 8'h10 || control_byte == 8'h11)) begin
                            candidate_valid <= 1'b1;
                            candidate_side  <= control_byte[0];
                            candidate_price <= price_shift;
                        end
                    end
                    default: byte_index <= 3'd0;
                endcase
            end
        end
    end
endmodule

`default_nettype wire
