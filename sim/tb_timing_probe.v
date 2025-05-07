`timescale 1ns/1ps
`default_nettype none

module tb_timing_probe;
    reg clk_48mhz = 1'b0;
    always #5 clk_48mhz = ~clk_48mhz;
    reg reset_n = 1'b0;
    reg uart_rx_pin = 1'b1;
    wire activity_pin;
    integer framing_errors = 0;

    timing_probe_top dut (
        .clk_48mhz(clk_48mhz), .reset_n(reset_n),
        .uart_rx_pin(uart_rx_pin), .activity_pin(activity_pin)
    );

    always @(posedge clk_48mhz)
        if (dut.receiver.framing_error)
            framing_errors = framing_errors + 1;

    task send_bit;
        input value;
        begin
            @(negedge clk_48mhz);
            uart_rx_pin = value;
            repeat (16) @(posedge clk_48mhz);
        end
    endtask

    task send_byte;
        input [7:0] value;
        input stop_bit;
        integer i;
        begin
            send_bit(1'b0);
            for (i = 0; i < 8; i = i + 1)
                send_bit(value[i]);
            send_bit(stop_bit);
        end
    endtask

    task send_frame;
        input [55:0] frame;
        integer i;
        begin
            for (i = 0; i < 7; i = i + 1)
                send_byte(frame[55 - i*8 -: 8], 1'b1);
        end
    endtask

    initial begin
        repeat (3) @(posedge clk_48mhz);
        @(negedge clk_48mhz); reset_n = 1'b1;

        send_frame(56'hA5100000006453);
        repeat (4) @(posedge clk_48mhz);
        #1;
        if (!dut.core.bid_valid || dut.core.best_bid !== 32'd100 ||
            dut.core.ask_valid || dut.core.best_ask !== 32'd0)
            $fatal(1, "UART bid frame failed");

        send_frame(56'hA511000000C87C);
        repeat (4) @(posedge clk_48mhz);
        #1;
        if (!dut.core.ask_valid || dut.core.best_ask !== 32'd200)
            $fatal(1, "UART ask frame failed");

        send_frame(56'hA510FFFFFFFFB7);
        repeat (4) @(posedge clk_48mhz);
        #1;
        if (dut.core.best_bid !== 32'd100)
            $fatal(1, "bad CRC changed state over UART");

        send_byte(8'hA5, 1'b0);
        send_bit(1'b1);
        repeat (4) @(posedge clk_48mhz);
        #1;
        if (framing_errors !== 1)
            $fatal(1, "UART stop-bit error was not reported");

        $display("PASS tb_timing_probe");
        $finish;
    end
endmodule

`default_nettype wire
