; Simple program that calculates the factiorial of a number
    LC $0 #12 ; Value to get the factorial of
    LC $1 #0 ; just 0 for the comparison
    LC $2 #1 ; result register
    LC $4 store
    LC $5 #1
    ; if the value of $0 is 0 then terminate
    CMP $3 $1 $0
    BBO $3 end
; multiply until we hit 0
factorial:
    MUL $2 $2 $0
    SUB $0 $0 $5
    CMPLT $3 $1 $0
    BBO $3 factorial
end:
    SW $2 $4 #0
    HALT
store:
    CT #0
