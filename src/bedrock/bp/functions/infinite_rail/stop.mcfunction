# Ends the ride -- same command as Java, modulo the / path separator:
#   /function infinite_rail/stop
# One-line bridge into scripts/main.js (see start.mcfunction; the message
# argument is required by /scriptevent but unused).
scriptevent infinite_rail:stop go
