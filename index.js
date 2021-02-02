const stringSimilarity          = require("string-similarity");
const busboy                    = require('connect-busboy'); 
const Algorithmia               = require("algorithmia");
const fs                        = require('fs-extra'); 
const express                   = require('express');
const DotEnv                    = require("dotenv");
const { BrainlyAPI, Server }    = require("brainly-api");
const bodyParser                = require("body-parser");

const app                       = express();
const port                      = 5152;

DotEnv.config();
app.use(busboy());
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.route('/upload')
    .post(async function (req, res) {
            var input = {
                image:  req.body.file,
                language: process.env.LANGUAGE
            };
            console.log("Extracting text...");
            var base64Data = req.body.file.replace(/^data:image\/jpeg;base64,/, "");
            require("fs").writeFile("img/out.jpeg", base64Data, 'base64', function(err) {
                if(err) console.log(err);
            });
            try{
                await Algorithmia.client(process.env.ALGORITHMIA)
                    .algo("character_recognition/SmartTextExtraction/0.1.1")
                    .pipe(input)
                    .then(function(response) {
                        console.log("Text Extracted");
                        const texts = textTypes(predictedText(response.get()));
                        console.log("Searching the answer in Brainly...");
                        BrainlyAPI.startWorker({ experimental: true, server: Server.PT }, async brainly => {
                            console.log("Answer is ready!");
                            const answers = await brainly.findQuestion(texts.enunciated);
                            const answer = answers['_questionDetails'][0].raw.node.answers.nodes[0].content;
                            const responses = stringSimilarity.findBestMatch(answer, texts.answers);
                            const response = responses.bestMatch.target;
                            const response_index = texts.answers.indexOf(response);
                            console.log("The answer is "+['A','B','C','D','E'][response_index]);
                            res.send(['A','B','C','D','E'][response_index]);
                        });
                    });
            }catch(e){
                console.error(e);
                res.send(e);
            } 
    });

app.listen(port, () => {
     console.log(`Vivian listening at http://localhost:${port}`)
})

function predictedText(result){
    let texts = result.predictions.sort((a, b) => {
        return a.box.y0 > b.box.y0 ? 1 : -1
    });
    return texts.map(r => r.predicted_text); 
}

function textTypes(predict){
    const question = predict.filter(p => p.includes("QUESTAO "));
    const answers = predict.splice(predict.length - 6, 5);
    const enunciated = predict.filter(p => !(p.includes("QUESTAO "))).join("");
    return {
        question,
        answers,
        enunciated
    }
}