const express = require('express');
const cheerio = require('cheerio');
const cors = require('cors');

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());

const scrapeByUrl = async (memo, index) => {
    try {
        let array = Object.keys(memo.urls);
        let url = array[index];
        console.log(url);
        let response = await fetch(url);
        let body = await response.text();
        let $ = cheerio.load(body);

        $('a').map((i, el) => {
            let link = $(el).attr('href');
            if (!array.includes(link) && link !== undefined && !link.includes('#') && (link.includes('https://relayhub.com') || link.includes('https://landingpage.relayhub.com'))) {
                memo.urls[link] = {};
            }
        });

        let metas = await getMeta(url);
        memo.urls[url]['metaTags'] = metas;

        let contentLength = await getContentLength(url);
        memo.urls[url]['contentLength'] = contentLength[0];
        memo.urls[url]['keywords'] = contentLength[1];

        let headers = await getH1(url);
        memo.urls[url]['headers'] = headers;

        let images = await getImage(url);
        memo.urls[url]['images'] = images;

        if (index < Object.keys(memo.urls).length - 1) {
            await scrapeByUrl(memo, index + 1);
        }

        return memo;
    } catch (error) {
        console.log(error);
    }
};

const getContentLength = async (url) => {
    let response = await fetch(url);
    let body = await response.text();
    let $ = cheerio.load(body);

    let whatToCount = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'];
    let exclusions = ['to', 'and', 'with', 'the', 'of',
        'our', 'your', 'is', 'in', 'we',
        'a', 'be', 'as', 'are', 'you',
        'should', 'this', 'or', 'their', 'they',
        'have', 'by', 'for', 'that', 'can'];
    let count = 0, keywords = {}, result = {};

    whatToCount.forEach(x => $(x).map((i, el) => {
        if (el.children.length > 0) {
            if (el.children[0].data !== undefined) {
                count += el.children[0].data.length;
                el.children[0].data.split(" ").forEach(y => {
                    y = y.toLowerCase();
                    if (!exclusions.includes(y)) {
                        keywords[y] = (keywords[y] || 0) + 1
                    }
                })
            }
        }
    }))

    Object.keys(keywords).sort((a, b) => keywords[b] - keywords[a]).slice(0, 5).forEach(x => result[x] = keywords[x]);

    console.log(`Length: ${count}`);
    console.log(result);
    return [count, result];
}

const getH1 = async (url) => {
    let response = await fetch(url);
    let body = await response.text();
    let $ = cheerio.load(body);

    let count = 0, count2 = 0, headers = { 'h1': {}, 'h2': {}, 'h3': {}, 'h4': {}, 'h5': {}, 'h6': {}, };
    Object.keys(headers).forEach(x => {
        $(x).map((i, el) => {
            count += 1;
            if (el.children.length > 0) {
                headers[x][count] = el.children[0].data;
            } else {
                headers[x][count] = `~~~ Empty ${x} ~~~`
            }
        })
        count = 0;
    })

    console.log(headers);
    return headers;
};

const getImage = async (url) => {
    let response = await fetch(url);
    let body = await response.text();
    let $ = cheerio.load(body);
    let obj = {};

    let results = await Promise.allSettled($('img').map(async (i, el) => {
        let imgUrl = $(el).attr('src');
        let imgAlt = $(el).attr('alt');
        console.log(imgAlt);

        let size;
        if (obj[imgUrl]) {
            obj[imgUrl]['alt'] = imgAlt;
            if (obj[imgUrl]['over100kb']) {
                size = obj[imgUrl]['over100kb']['size'];
            } else {
                size = 0;
            }
        } else {
            obj[imgUrl] = {};
            obj[imgUrl]['alt'] = imgAlt;
            size = await getSize(imgUrl);
            console.log(size);
        }

        if (size >= 10000) {
            size = Math.round(size / 1000);
            size = size.toString() + " KB";
            console.log(size);
            obj[imgUrl] = { size: size };
        }
    }))

    console.log(results);
    let rejected = results.filter(res => res.status === 'rejected').map(res => {
        console.log("Rejected-123", res);
        obj['Rejections'] = res;
    });

    return obj;
}

const getSize = async (url) => {
    let res = await fetch(url, { method: 'HEAD' });
    let filter = [...res.headers].filter(x => x[0] === 'content-length');
    let size;
    if (filter.length > 0) {
        [, size] = filter[0];
    }

    return size;
};

const getMeta = async (url) => {
    let response = await fetch(url);
    let body = await response.text();
    let $ = cheerio.load(body);

    let title, description;
    $('meta').map((i, el) => {
        if (el.attribs.name === 'description') {
            description = el.attribs.content;
        }
        if (el.attribs.property === 'og:title') {
            title = el.attribs.content;
        }
    })
    console.log(title, description);
    return { title: title, description: description };
}

app.get('/', (req, res) => {
    res.json({ status: "Server is working" });
})

app.get('/scrape', async (req, res) => {
    try {
        let memo = { SEOComments: {}, urls: { 'https://relayhub.com/': {} } };
        memo['SEOComments'] = {
            targetKeyword: "Ensure your target keyword appears in the title tag, meta description, headings (H1, H2, etc.), and image alt tags.",
            contentLength: "Google recommends each page have at least 300 words so crawlers can get a clear idea of its purpose.",
            h1: "Ideally there should be one <h1> per page that matches SEO keywords/meta tags.",
            imageSize: "Images should be < 100kb to optimize how fast the page loads for SEO purposes. Images over 100kb will be tagged with their size.",
            imageAlt: "Images should have descriptive alt text that ideally matches the content on the page.",
        }
        let result = await scrapeByUrl(memo, 0);
        res.json(result);
    } catch (error) {
        console.log(error);
    }
});

app.get('/image', async (req, res) => {
    try {
        let result = await getImage('https://relayhub.com/increase-your-school-based-medicaid-iq-in-3-easy-steps/');
        console.log(result);
        res.json(result);
    } catch (error) {
        console.log(error);
    }
});

app.get('/test', async (req, res) => {
    try {
        let result = await getMeta('https://relayhub.com/');
        console.log(result);
        res.json(result);
    } catch (error) {
        console.log(error);
    }
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`App is listening on port ${port}`)
})