`timescale 1ns/1ps
`default_nettype none

// One candidate may be accepted on every rising edge. A candidate accepted at
// edge N updates the registered BBO at edge N+1.
module candidate_bbo (
    input  wire        clk,
    input  wire        rst,
    input  wire        candidate_valid,
    output wire        candidate_ready,
    input  wire        candidate_side,  // 0=bid, 1=ask
    input  wire [31:0] candidate_price,
    output reg         bid_valid,
    output reg  [31:0] best_bid,
    output reg         ask_valid,
    output reg  [31:0] best_ask
);
    reg        pending_valid;
    reg        pending_side;
    reg [31:0] pending_price;

    assign candidate_ready = !rst;

    always @(posedge clk) begin
        if (rst) begin
            pending_valid <= 1'b0;
            pending_side  <= 1'b0;
            pending_price <= 32'b0;
            bid_valid     <= 1'b0;
            best_bid      <= 32'b0;
            ask_valid     <= 1'b0;
            best_ask      <= 32'b0;
        end else begin
            pending_valid <= candidate_valid;
            if (candidate_valid) begin
                pending_side  <= candidate_side;
                pending_price <= candidate_price;
            end

            if (pending_valid) begin
                if (!pending_side) begin
                    if (!bid_valid || pending_price > best_bid) begin
                        bid_valid <= 1'b1;
                        best_bid  <= pending_price;
                    end
                end else if (!ask_valid || pending_price < best_ask) begin
                    ask_valid <= 1'b1;
                    best_ask  <= pending_price;
                end
            end
        end
    end
endmodule

`default_nettype wire
