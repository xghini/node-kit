export { default_routes };
function default_routes() {
    return [
        ["/", "*", "*", hd_hello.bind("Ghini"), undefined, {}],
        [/^\/gold/, "*", "*", hd_hello.bind("RegExp"), undefined, {}],
        ["/gold", "*", "*", hd_default, undefined, {}],
        ["/data", "POST", "*", hd_data, undefined, {}],
        ["/error", "*", "*", hd_error, undefined, {}],
        ["/stream", "*", "*", hd_stream, undefined, {}],
        ["/countdata", "*", "*", (g) => g.end(g.body), hd_countdata, {}],
    ];
}
function hd_default(gold) {
    gold.json(gold);
}
function hd_hello(gold) {
    let data = { hello: "http" + gold.httpVersion };
    if (this)
        data.hi = this;
    gold.json(data);
}
function hd_stream(gold) {
    gold.respond({
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
    });
    let count = 3;
    gold.write(`data: ${count}\n\n`);
    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            gold.write(`data: ${count}\n\n`);
        }
        else {
            gold.write(`data: ${count}\n\n`);
            gold.write("data: Countdown complete!\n\n");
            clearInterval(interval);
            gold.end();
        }
    }, 1000);
}
function hd_data(gold) {
    gold.respond({ "Content-Type": "application/json; charset=utf-8" });
    gold.write(JSON.stringify(gold.param, "", 2) + "\n");
    gold.end(gold.body);
}
async function hd_error(gold) {
    gold.enderror(gold.body);
}
function hd_routes(gold) {
    console.log(this);
    gold.json(this);
}
function hd_countdata(gold, chunk, chunks) {
    gold.respond({
        ":status": 200,
        "content-type": "text/plain;charset=UTF-8",
    });
    console.log(chunk, chunks.length);
    chunks.push(Buffer.from(chunks.length + ","));
    gold.write(`data: ${chunks.length}\n`);
}
