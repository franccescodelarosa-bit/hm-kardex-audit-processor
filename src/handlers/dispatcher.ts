import { SFNClient, StartExecutionCommand} from "@aws-sdk/client-sfn";
const client = new SFNClient({ region: process.env.AWS_REGION });
export const handler = async (event: any) => {
console.log("RAW EVENT", event);
    const payload = typeof event === "string" ? JSON.parse(event) : event;
    console.log("PAYLOAD", payload);
    const auditJobId = payload.auditJobId;
    if (!auditJobId) {
        throw new Error("auditJobId is required");
    }
    const execution = await client.send(
        new StartExecutionCommand({
            stateMachineArn:process.env.STATE_MACHINE_ARN,
            input: JSON.stringify({ auditJobId })
        })
    );
    console.log( "Execution Started:", execution.executionArn);
    return {
        ok: true,
        executionArn: execution.executionArn,
    };
};