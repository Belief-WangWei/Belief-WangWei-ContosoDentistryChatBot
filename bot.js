// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, MessageFactory } = require('botbuilder');
const {CustomQuestionAnswering} = require('botbuilder-ai');
const IntentRecognizer = require("./intentRecognizer.js");
const DentistScheduler = require('./dentistScheduler.js');

class DentistBot extends ActivityHandler {
    constructor(configuration, qnaOptions) {
        // call the parent constructor
        super();
        if (!configuration) throw new Error('[DentistBot]: Missing parameter. A configuration is required');

        // create a QnAMaker connector
        this.qnaMaker = new CustomQuestionAnswering(configuration.QnAConfiguration);
        
        // create a DentistScheduler connector
        this.dentistSchedulerConnector = new DentistScheduler(configuration.SchedulerConfiguration);
    
        // create a IntentRecognizer connector
        this.intentRecognizerConnector = new IntentRecognizer(configuration.CluConfiguration);

        this.onMessage(async (context, next) => {
            // send user input to QnA Maker and collect the response in a variable
            // don't forget to use the 'await' keyword
            const qnaResults = await this.qnaMaker.getAnswers(context);
            console.log('[DentistBot]: ', qnaResults)

            // send user input to IntentRecognizer and collect the response in a variable
            // don't forget 'await' 
            const cluResults = await this.intentRecognizerConnector.executeCluQuery(context);
            console.log('[DentistBot]: ', cluResults)
                                           
           // determine which service to respond with based on the results from LUIS //
            if(cluResults.result.prediction.topIntent === "GetAvailability" && cluResults.result.prediction.intents[0].confidence > .75){
                console.log('[DentistBot]: topIntent is GetAvailability');
               
                const schedulerResults = await this.dentistSchedulerConnector.getAvailability();
                console.log(schedulerResults)
                await context.sendActivity(schedulerResults);
                await next();
                return;
            }
            else if(cluResults.result.prediction.topIntent === "ScheduleAppointment" && cluResults.result.prediction.intents[0].confidence > .75 && cluResults.result.prediction.entities.length > 0){
                console.log('[DentistBot]: topIntent is ScheduleAppointment');
               const appointment = cluResults.result.prediction.entities;

                if (appointment[0].category === "datatime" && (appointment !== undefined || appointment != null)) {
                   console.log('[DentistBot]: appointment is ', appointment[0].text)
                    const schedulerResults = await this.dentistSchedulerConnector.scheduleAppointment(appointment[0].text);

                    console.log(schedulerResults)
                    await context.sendActivity(schedulerResults);
                    await next();
                    return;
               }
                else {
                    await context.sendActivity("I am sorry for any misunderstanding. Could you let me know the date and time of your appointment?");
                    await next();
                    return;
                }
            }
            else
             if(qnaResults[0].score > .75) {
                await context.sendActivity(`${qnaResults[0].answer}`);
            }
            else {
                await context.sendActivity(`I'm sorry, I didn't quite catch that.`);
            }
             
            await next();
    });

        this.onMembersAdded(async (context, next) => {
        const membersAdded = context.activity.membersAdded;
        //write a custom greeting
        const welcomeText = 'Welcome to Wang Wei Dental Assistant Bot. We are here to help with your dental needs. Feel free to ask about our services, schedule an appointment, or get any information you need. Your smile is our priority!';
        for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
            if (membersAdded[cnt].id !== context.activity.recipient.id) {
                await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
            }
        }
        // by calling next() you ensure that the next BotHandler is run.
        await next();
    });
    }
}

module.exports.DentistBot = DentistBot;