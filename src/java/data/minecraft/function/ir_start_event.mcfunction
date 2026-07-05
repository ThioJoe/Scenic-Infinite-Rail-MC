# Dual-dialect call bridge (Java half). The shared brain files cannot spell an
# engine-specific function path (Java "infinite_rail:start_event" vs Bedrock
# "infinite_rail/start_event"), so they call the bare name "ir_start_event" instead --
# which Java resolves in the minecraft namespace to this one-line trampoline,
# and Bedrock resolves to the trampoline at its functions/ root. Both hop
# straight into the shared file; nothing else may live here.
function infinite_rail:start_event
