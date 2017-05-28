; Calculate the inner product of two vectors
    LC $2 vectorLen
    LC $0 vectorX
    LC $1 vectorY
    LW $2 $2 #0 ; load the length of the input vectors
    LC $10 #0 ; accumulator register
    LC $5 #0 ; loop counter
dotLoop:
    LW $3 $0 #0
    LW $4 $1 #0
    ADDI $0 $0 #1
    ADDI $1 $1 #1
    MUL $3 $3 $4
    ADD $10 $10 $3
    ADDI $5 $5 #1
    CMPLT $3 $5 $2
    BBO $3 dotLoop
    LC $3 dot
    SW $10 $3 #0
    HALT
vectorLen:
    CT #5
vectorX:
    CT #1
    CT #1
    CT #1
    CT #1
    CT #1
vectorY:
    CT #1
    CT #1
    CT #1
    CT #1
    CT #1
dot:
    CT #0
