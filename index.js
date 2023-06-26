const express = require('express');
const cheerio = require('cheerio');
const cors = require('cors');

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

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
        memo.urls[url]['contentLength'] = contentLength;

        let h1Counter = await getH1(url);
        memo.urls[url]['h1Count'] = h1Counter;

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
    let count = 0;
    whatToCount.forEach(x =>  $(x).map((i, el) => {
        if (el.children.length > 0) {
            if (el.children[0].data !== undefined) {
                count += el.children[0].data.length;
            }
        }
    }))
    console.log(`Length: ${count}`);
    return count;
}

const getH1 = async (url) => {
    let response = await fetch(url);
    let body = await response.text();
    let $ = cheerio.load(body);

    let count = 0;
    $('h1').map(() => {
        count += 1; 
    });

    return count;
};

const getImage = async (url) => {
    let response = await fetch(url);
    let body = await response.text();
    let $ = cheerio.load(body);
    let obj = {};

    await Promise.allSettled($('img').map( async (i, el) => {
        let imgUrl = $(el).attr('src');
        let imgAlt = $(el).attr('alt');
        console.log(imgAlt);
        obj[imgUrl] = {};
        obj[imgUrl]['alt'] = imgAlt;
    
        let size = await getSize(imgUrl) || "";
        if (size >= 100000) {
            size = Math.round(size / 1000);
            size = size.toString() + " KB";
            console.log(size);
            obj[imgUrl]['over100kb'] = { size: size };
        }
    }))
    
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
        let memo = { SEOComments: {}, urls: { 'https://relayhub.com/' : {} } };
        memo['SEOComments'] = {
            h1: "Ideally there should be one <h1> per page that matches SEO keywords/meta tags.",
            imageSize: "Images should be < 100kb to optimize how fast the page loads for SEO purposes. Images over 100kb will be tagged with their size.",
            imageAlt: "Images should have descriptive alt text that ideally matches the content on the page.",
            contentLength: "Google recommends each page have at least 300 words so crawlers can get a clear idea of its purpose."
        }
        let result = await scrapeByUrl(memo, 0);
        res.json(result);
    } catch (error) {
        console.log(error);
    }
});

app.get('/image', async (req, res) => {
    try {
        let result = await getImage('https://relayhub.com/school-medicaid-coverage-and-billing-by-state/');
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