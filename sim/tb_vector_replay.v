`timescale 1ns/1ps
`default_nettype none

module tb_vector_replay;
    reg clk = 1'b0;
    always #5 clk = ~clk;

    reg rst = 1'b0;
    reg byte_valid = 1'b0;
    reg [7:0] byte_data = 8'b0;
    wire byte_ready;
    wire bid_valid;
    wire [31:0] best_bid;
    wire ask_valid;
    wire [31:0] best_ask;

    reg [0:0] actions [0:255];
    reg [55:0] frames [0:255];
    reg [0:0] accepted [0:255];
    reg [65:0] expected [0:255];
    integer vector_count;
    integer vector_index;
    integer byte_index;

    market_data_core dut (
        .clk(clk), .rst(rst), .byte_valid(byte_valid),
        .byte_ready(byte_ready), .byte_data(byte_data),
        .bid_valid(bid_valid), .best_bid(best_bid),
        .ask_valid(ask_valid), .best_ask(best_ask)
    );

    task check_state;
        input [65:0] wanted;
        begin
            if ({bid_valid, best_bid, ask_valid, best_ask} !== wanted)
                $fatal(1, "vector %0d: got bid=%b:%h ask=%b:%h; expected %h",
                    vector_index, bid_valid, best_bid, ask_valid, best_ask, wanted);
        end
    endtask

    task send_frame;
        input [55:0] frame;
        begin
            for (byte_index = 0; byte_index < 7; byte_index = byte_index + 1) begin
                @(negedge clk);
                if (!byte_ready)
                    $fatal(1, "vector %0d: unexpected byte stall", vector_index);
                byte_valid = 1'b1;
                byte_data = frame[55 - byte_index*8 -: 8];
            end
            @(negedge clk);
            byte_valid = 1'b0;
        end
    endtask

    initial begin
        if (!$value$plusargs("vector_count=%d", vector_count))
            $fatal(1, "missing vector_count");
        if (vector_count < 1 || vector_count > 256)
            $fatal(1, "invalid vector_count");
        $readmemh("actions.mem", actions, 0, vector_count - 1);
        $readmemh("frames.mem", frames, 0, vector_count - 1);
        $readmemh("accepted.mem", accepted, 0, vector_count - 1);
        $readmemh("expected.mem", expected, 0, vector_count - 1);

        for (vector_index = 0; vector_index < vector_count;
             vector_index = vector_index + 1) begin
            if (!actions[vector_index]) begin
                @(negedge clk);
                rst = 1'b1;
                @(posedge clk);
                #1 check_state(expected[vector_index]);
                @(negedge clk);
                rst = 1'b0;
            end else begin
                send_frame(frames[vector_index]);
                if (dut.candidate_valid !== accepted[vector_index])
                    $fatal(1, "vector %0d: candidate acceptance mismatch", vector_index);
                @(posedge clk);
                @(posedge clk);
                #1 check_state(expected[vector_index]);
            end
        end

        $display("PASS tb_vector_replay (%0d vectors)", vector_count);
        $finish;
    end
endmodule

`default_nettype wire
