; Slightly more complex programs to multiply two matrices
    LC $0 matrixX ; pointer to matrix X
    LC $1 matrixY ; pointer to matrix Y
    LC $2 matrixDims
    LC $30 matrixRes ; pointer to storage location
    LW $2 $2 #0
    LC $3 #0 ; loop counter on X
; start of loopOnY routine
loopOnX:
    LC $5 #0 ; loop counter on Y
    MV $6 $1 ; make a copy of pointer to Y
; start of loop multiply routine
loopOnY:
    MV $7 $6 ; make a copy of pointer to Y
    MV $8 $0 ; make a copy of pointer to X
    LC $29 #0 ; store 0 in the accummulator
    LC $11 #0 ; loop counter
loopMultiply:
    LW $9 $7 #0 ; load the value of vatrix Y
    LW $10 $8 #0 ; load the value of matrix X
    ADDI $8 $8 #1 ; increment ptr to X by 1
    ADD $7 $7 $2 ; increment the column pointer of Y by the width of the matrix
    MUL $28 $9 $10; multiply the values
    ADD $29 $29 $28 ; add the value to accummulator
    ADDI $11 $11 #1 ; increment the counter
    CMPLT $4 $11 $2 ; only loop if we havent reached the end of the row/col
    BBO $4 loopMultiply
; end of loopMultiply routine
    ADDI $5 $5 #1 ; increment loop counter for onLoopY
    SW $29 $30 #0 ; store this result
    ADDI $30 $30 #1 ; increment store pointer by 1
    ADDI $6 $6 #1 ; increment pointer to point to next column
    CMPLT $4 $5 $2
    BBO $4 loopOnY
; end of loopOnYroutine
    ADDI $3 $3 #1 ; increment cntr by 1
    ADD $0 $0 $2
    CMPLT $4 $3 $2 ; if the cntr is < matrixWidth then loop
    BBO $4 loopOnX
    HALT
matrixDims:
    CT #2
matrixX:
    CT #1
    CT #2
    CT #3
    CT #4
matrixY:
    CT #5
    CT #6
    CT #7
    CT #8
matrixRes:
    CT #0
