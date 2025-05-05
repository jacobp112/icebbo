`timescale 1ns/1ps
`default_nettype none

module tb_frame_parser;
    reg clk = 1'b0;
    always #5 clk = ~clk;

    reg rst = 1'b0;
    reg byte_valid = 1'b0;
    reg [7:0] byte_data = 8'b0;
    wire byte_ready;
    wire candidate_valid;
    reg candidate_ready = 1'b0;
    wire candidate_side;
    wire [31:0] candidate_price;
    integer transfer_count = 0;

    frame_parser dut (
        .clk(clk), .rst(rst), .byte_valid(byte_valid),
        .byte_ready(byte_ready), .byte_data(byte_data),
        .candidate_valid(candidate_valid), .candidate_ready(candidate_ready),
        .candidate_side(candidate_side), .candidate_price(candidate_price)
    );

    always @(posedge clk) begin
        if (!rst && candidate_valid && candidate_ready)
            transfer_count = transfer_count + 1;
    end

    task send_byte;
        input [7:0] value;
        begin
            @(negedge clk);
            if (!byte_ready) $fatal(1, "unexpected parser stall");
            byte_valid = 1'b1;
            byte_data = value;
        end
    endtask

    task send_frame;
        input [55:0] frame;
        integer i;
        begin
            for (i = 0; i < 7; i = i + 1)
                send_byte(frame[55 - i*8 -: 8]);
            @(negedge clk);
            byte_valid = 1'b0;
        end
    endtask

    task send_two_frames;
        input [55:0] first_frame;
        input [55:0] second_frame;
        integer i;
        begin
            for (i = 0; i < 14; i = i + 1) begin
                @(negedge clk);
                if (!byte_ready) $fatal(1, "unexpected stall between frames");
                byte_valid = 1'b1;
                if (i < 7)
                    byte_data = first_frame[55 - i*8 -: 8];
                else
                    byte_data = second_frame[55 - (i-7)*8 -: 8];
            end
            @(negedge clk);
            byte_valid = 1'b0;
        end
    endtask

    initial begin
        @(negedge clk); rst = 1'b1;
        @(negedge clk); rst = 1'b0;

        // Hold a decoded candidate while the consumer is stalled.
        send_frame(56'hA5100000006453);
        if (!candidate_valid || candidate_side || candidate_price !== 32'd100)
            $fatal(1, "first candidate decode failed");
        if (byte_ready) $fatal(1, "byte_ready high during output stall");
        byte_valid = 1'b1;
        byte_data = 8'hA5;
        repeat (3) begin
            @(posedge clk); #1;
            if (byte_ready || !candidate_valid || candidate_price !== 32'd100)
                $fatal(1, "candidate changed during output stall");
        end

        // Consume the old candidate and the next SOF on the same edge.
        @(negedge clk); candidate_ready = 1'b1;
        @(posedge clk); #1;
        if (transfer_count !== 1 || candidate_valid || dut.byte_index !== 3'd1)
            $fatal(1, "simultaneous candidate/SOF transfer failed");
        @(negedge clk); byte_valid = 1'b0;
        send_byte(8'h10);
        send_byte(8'h00);
        send_byte(8'h00);
        send_byte(8'h00);
        send_byte(8'h6E);
        send_byte(8'h65);
        @(negedge clk); byte_valid = 1'b0;
        if (!candidate_valid || candidate_side || candidate_price !== 32'd110)
            $fatal(1, "second candidate decode failed");
        @(posedge clk); #1;
        if (transfer_count !== 2 || candidate_valid)
            $fatal(1, "second candidate transfer failed");

        // Reset clears an incomplete frame; its suffix cannot form a candidate.
        send_byte(8'hA5);
        send_byte(8'h10);
        send_byte(8'h01);
        @(negedge clk); rst = 1'b1; byte_valid = 1'b0;
        @(posedge clk); #1;
        if (candidate_valid || byte_ready || dut.byte_index !== 3'd0)
            $fatal(1, "mid-frame reset failed");
        @(negedge clk); rst = 1'b0;
        send_byte(8'h02);
        send_byte(8'h03);
        send_byte(8'h04);
        @(negedge clk); byte_valid = 1'b0;
        if (candidate_valid || transfer_count !== 2)
            $fatal(1, "truncated frame suffix was accepted");

        // A complete frame still decodes after reset and ignored suffix bytes.
        send_frame(56'hA511000000C87C);
        if (!candidate_valid || !candidate_side || candidate_price !== 32'd200)
            $fatal(1, "post-reset ask decode failed");
        @(posedge clk); #1;
        if (transfer_count !== 3 || candidate_valid)
            $fatal(1, "post-reset ask transfer failed");

        // No idle byte is needed between consecutive complete frames.
        send_two_frames(56'hA5100000006453, 56'hA511000000C87C);
        if (transfer_count !== 4 || !candidate_valid ||
            !candidate_side || candidate_price !== 32'd200)
            $fatal(1, "consecutive frame decode failed");
        @(posedge clk); #1;
        if (transfer_count !== 5 || candidate_valid)
            $fatal(1, "consecutive frame transfer failed");

        $display("PASS tb_frame_parser");
        $finish;
    end
endmodule

`default_nettype wire
