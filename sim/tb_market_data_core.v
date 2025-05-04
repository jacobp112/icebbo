`timescale 1ns/1ps
`default_nettype none

module tb_market_data_core;
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

    market_data_core dut (
        .clk(clk), .rst(rst), .byte_valid(byte_valid),
        .byte_ready(byte_ready), .byte_data(byte_data),
        .bid_valid(bid_valid), .best_bid(best_bid),
        .ask_valid(ask_valid), .best_ask(best_ask)
    );

    integer byte_number;
    task send_frame;
        input [55:0] frame;
        begin
            for (byte_number = 0; byte_number < 7; byte_number = byte_number + 1) begin
                @(negedge clk);
                if (!byte_ready) $fatal(1, "parser unexpectedly stalled");
                byte_valid = 1'b1;
                byte_data = frame[55 - byte_number*8 -: 8];
            end
            @(negedge clk);
            byte_valid = 1'b0;
        end
    endtask

    task check_state;
        input expected_bid_valid;
        input [31:0] expected_bid;
        input expected_ask_valid;
        input [31:0] expected_ask;
        begin
            if (bid_valid !== expected_bid_valid || best_bid !== expected_bid ||
                ask_valid !== expected_ask_valid || best_ask !== expected_ask)
                $fatal(1, "BBO got bid=%b:%h ask=%b:%h; expected bid=%b:%h ask=%b:%h",
                    bid_valid, best_bid, ask_valid, best_ask,
                    expected_bid_valid, expected_bid, expected_ask_valid, expected_ask);
        end
    endtask

    initial begin
        @(negedge clk);
        rst = 1'b1;
        @(posedge clk);
        #1 check_state(0, 0, 0, 0);
        @(negedge clk);
        rst = 1'b0;

        send_frame(56'hA5100000006453); // bid 100
        check_state(0, 0, 0, 0);        // frame complete, not yet applied
        @(posedge clk); #1 check_state(0, 0, 0, 0); // core accepts
        @(posedge clk); #1 check_state(1, 100, 0, 0); // core updates

        send_frame(56'hA511000000C87C); // ask 200
        repeat (2) @(posedge clk);
        #1 check_state(1, 100, 1, 200);

        send_frame(56'hA5100000006E65); // better bid 110
        repeat (2) @(posedge clk);
        #1 check_state(1, 110, 1, 200);

        send_frame(56'hA5100000005AE9); // worse bid 90
        repeat (2) @(posedge clk);
        #1 check_state(1, 110, 1, 200);

        send_frame(56'hA510FFFFFFFFB7); // deliberately bad CRC
        repeat (2) @(posedge clk);
        #1 check_state(1, 110, 1, 200);

        send_frame(56'hA5120000006382); // unsupported type
        repeat (2) @(posedge clk);
        #1 check_state(1, 110, 1, 200);

        @(negedge clk);
        rst = 1'b1;
        @(posedge clk);
        #1 check_state(0, 0, 0, 0);
        $display("PASS tb_market_data_core");
        $finish;
    end
endmodule

`default_nettype wire
