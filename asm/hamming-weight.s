; Calculate the hamming weight of a number
    LC $0 value
    LW $0 $0 #0 ; This is the hamming weight to be computed
    LC $1 #0 ; This is the final hamming weight
    LC $2 #0
for:
    ANDI $4 $0 #1
    ADD $1 $1 $4
    SRL $0 $0 #1
    CMPLT $3 $2 $0 ; Branch if the value we are computing from isnt 0
    BBO $3 for
    LC $0 store
    SW $1 $0 #0
    HALT
store:
    CT #0
value:
    CT #12345
