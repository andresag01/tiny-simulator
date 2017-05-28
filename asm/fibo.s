; Program that calculates fibonacci
    LC $0 #45 ; Which fibo number would you like?
    LC $4 #0
    LC $1 #1
    LC $2 #1
; If we would like the 0th element then just
; give 1 back
    CMP $5 $4 $0
    BBO $5 end
; If we would like the 1st element then just
; give 1 back
    LC $4 #1
    CMP $5 $4 $0
    BBO $5 end
; Otherwise compute the number
for:
    ADD $3 $1 $2
    MV $1 $2
    MV $2 $3
    ADDI $4 $4 #1
    CMPLT $5 $4 $0
    BBO $5 for
; Store the value in some memory location
end:
    LC $0 store
    SW $2 $0 #0
    HALT
store:
    CT #0
