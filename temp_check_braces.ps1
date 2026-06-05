$lines = Get-Content script.js
$open = 0
$close = 0
$state = 'normal'
$escaped = $false
for ($lineno = 0; $lineno -lt $lines.Count; $lineno++) {
    $line = $lines[$lineno]
    for ($i = 0; $i -lt $line.Length; $i++) {
        $ch = $line[$i]
        if ($escaped) { $escaped = $false; continue }
        if ($ch -eq '\\') { $escaped = $true; continue }
        if ($state -eq 'normal') {
            if ($ch -eq "'") { $state = 'single'; continue }
            if ($ch -eq '"') { $state = 'double'; continue }
            if ($ch -eq '`') { $state = 'template'; continue }
            if ($ch -eq '{') { $open++ }
            if ($ch -eq '}') { $close++ }
            continue
        }
        if ($state -eq 'single') {
            if ($ch -eq "'") { $state = 'normal' }
            continue
        }
        if ($state -eq 'double') {
            if ($ch -eq '"') { $state = 'normal' }
            continue
        }
        if ($state -eq 'template') {
            if ($ch -eq '`') { $state = 'normal'; continue }
            if ($ch -eq '$' -and $i + 1 -lt $line.Length -and $line[$i+1] -eq '{') { $state = 'template_expr'; $i++; continue }
            continue
        }
        if ($state -eq 'template_expr') {
            if ($ch -eq "'") { $state = 'template_expr_single'; continue }
            if ($ch -eq '"') { $state = 'template_expr_double'; continue }
            if ($ch -eq '{') { $open++ }
            if ($ch -eq '}') { $close++; $state = 'template'; continue }
            continue
        }
        if ($state -eq 'template_expr_single') {
            if ($ch -eq "'") { $state = 'template_expr'; continue }
            continue
        }
        if ($state -eq 'template_expr_double') {
            if ($ch -eq '"') { $state = 'template_expr'; continue }
            continue
        }
    }
    if ($open -ne $close) {
        "$($lineno+1): open=$open close=$close diff=$($open-$close) $line"
    }
}
"TOTAL open=$open close=$close"
