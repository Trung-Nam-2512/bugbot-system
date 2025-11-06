function utcStamp(d = new Date()) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    const ss = String(d.getUTCSeconds()).padStart(2, "0");
    return `${y}${m}${day}_${hh}${mm}${ss}`;
}

function dayFolder(d = new Date()) {
    return d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

module.exports = { utcStamp, dayFolder };
