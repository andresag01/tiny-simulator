; Start program
    LC $1 data
    LC $6 end
while:
    MV $2 $1
    LC $0 #0
    LW $3 $2 #0
    ADDI $2 $2 #1
for:
    LW $4 $2 #0
    CMPLT $5 $4 $3
    BBO $5 swap
    MV $3 $4
continue:
    ADDI $2 $2 #1
    CMPLT $5 $2 $6
    BBO $5 for
    BBO $0 while
    HALT
; swap routine
swap:
    SW $4 $2 #-1
    SW $3 $2 #0
    LC $0 #1
    J continue
data:
    CT #4
    CT #8
    CT #1
    CT #10
    CT #4
    CT #2
    CT #100
    CT #99
end:
    CT #0
