# Dual-dialect call bridge (Bedrock half). The shared brain files cannot spell
# an engine-specific function path (Java "infinite_rail:consider_start" vs Bedrock
# "infinite_rail/consider_start"), so they call the bare name "ir_consider_start" instead --
# which Bedrock resolves from the functions/ root to this one-line trampoline,
# and Java resolves to the trampoline in its minecraft namespace. Both hop
# straight into the shared file; nothing else may live here.
function infinite_rail/consider_start
