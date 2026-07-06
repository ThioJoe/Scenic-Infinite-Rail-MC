# Internal constants shared by BOTH editions -- not user settings (those
# live in config.mcfunction, in the cfg_* objectives): fixed numbers the
# logic needs exactly once, kept out of the config file because there is no
# reason to tune them per world. They live in `ir` with the runtime state.
# Called once per load, right beside config: from load.mcfunction on Java,
# from the script's init() on Bedrock. (Java's fixed-point helpers .C2/.C10/
# .C12/.C16/.C100/.C1000 stay in load.mcfunction -- they exist only because
# scoreboards are int-only, and Bedrock does that math in floats.)

# How much one click of the "Speed -"/"Speed +" hotbar items changes the
# ride speed, in blocks/second -- read by both editions' speed_inc/speed_dec
# (the shared speed_step then clamps the result to 1..64).
scoreboard players set .SPEEDSTEP ir 4
