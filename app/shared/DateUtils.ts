export function toInputLiteral(date: Date) {
    return date.getUTCFullYear() + '-' +
        pad(date.getUTCMonth()+1, 2) + "-" +
        pad(date.getUTCDate(), 2) + "T" +
        pad(date.getHours(), 2) + ":" +
        pad(date.getMinutes(), 2) + ":" +
        pad(date.getSeconds(), 2);
}

function pad(n, width, z?) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}
