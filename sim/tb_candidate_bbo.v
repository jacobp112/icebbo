`timescale 1ns/1ps
`default_nettype none

module tb_candidate_bbo;
    reg clk = 1'b0;
    always #5 clk = ~clk;
    reg rst = 1'b0;
    reg candidate_valid = 1'b0;
    reg candidate_side = 1'b0;
    reg [31:0] candidate_price = 32'b0;
    wire candidate_ready;
    wire bid_valid;
    wire [31:0] best_bid;
    wire ask_valid;
    wire [31:0] best_ask;

    candidate_bbo dut (
        .clk(clk), .rst(rst),
        .candidate_valid(candidate_valid), .candidate_ready(candidate_ready),
        .candidate_side(candidate_side), .candidate_price(candidate_price),
        .bid_valid(bid_valid), .best_bid(best_bid),
        .ask_valid(ask_valid), .best_ask(best_ask)
    );

    initial begin
        @(negedge clk); rst = 1'b1;
        if (candidate_ready !== 1'b0) $fatal(1, "ready during reset");
        @(posedge clk);
        #1;
        if (bid_valid !== 0 || ask_valid !== 0) $fatal(1, "reset valid bits");
        @(negedge clk); rst = 1'b0;

        // Both bid candidates are accepted on consecutive rising edges.
        candidate_valid = 1'b1;
        candidate_side = 1'b0;
        candidate_price = 32'd10;
        @(posedge clk); #1;
        if (bid_valid !== 0) $fatal(1, "updated at acceptance edge");
        @(negedge clk); candidate_price = 32'd20;
        @(posedge clk); #1;
        if (bid_valid !== 1 || best_bid !== 10)
            $fatal(1, "first bid update or pipeline timing incorrect");
        @(negedge clk); candidate_valid = 1'b0;
        @(posedge clk); #1;
        if (best_bid !== 20) $fatal(1, "back-to-back bid hazard");

        // Zero is an accepted first ask, not an invalid sentinel.
        @(negedge clk); candidate_valid = 1'b1;
        candidate_side = 1'b1;
        candidate_price = 32'd0;
        @(negedge clk); candidate_valid = 1'b0;
        @(posedge clk); #1;
        if (ask_valid !== 1 || best_ask !== 0)
            $fatal(1, "zero ask failed");

        $display("PASS tb_candidate_bbo");
        $finish;
    end
endmodule

`default_nettype wire
