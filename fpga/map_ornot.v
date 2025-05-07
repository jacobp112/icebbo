// Workaround for Yosys 0.69 Windows -noabc leaving $_ORNOT_ cells after
// synth_ice40. I0=A and I1=B; LUT truth table is A | !B.
(* techmap_celltype = "$_ORNOT_" *)
module map_ornot (input A, input B, output Y);
    SB_LUT4 #(.LUT_INIT(16'hBBBB)) lut (
        .I0(A), .I1(B), .I2(1'b0), .I3(1'b0), .O(Y)
    );
endmodule
