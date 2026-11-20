// A fake Anthropic SDK for the function tests. Each request goes to `claude.answer`, which a test sets;
// `claude.calls` keeps every request so a test can check what the function asked.

type Params = Record<string, unknown>;
type Message = { model: string; usage: Record<string, number>; stop_reason: string | null; content: { type: string; text?: string }[] };

export const claude = {
  calls: [] as Params[],
  batches: [] as Params[],
  answer: (_params: Params): Message | Promise<Message> => {
    throw new Error('fake claude: no answer set for this test');
  },
  reset() {
    this.calls = [];
    this.batches = [];
    this.answer = () => {
      throw new Error('fake claude: no answer set for this test');
    };
  },
};

/** A text answer, the way the API returns it. */
export function textMessage(text: string, stop_reason = 'end_turn'): Message {
  return { model: 'fake', usage: { input_tokens: 10, output_tokens: 10 }, stop_reason, content: [{ type: 'text', text }] };
}

async function ask(params: Params) {
  claude.calls.push(params);
  return claude.answer(params);
}

export default class Anthropic {
  beta = {
    messages: {
      create: (params: Params) => ask(params),
      stream: (params: Params) => {
        const done = ask(params);
        return { finalMessage: () => done, abort: () => {} };
      },
      batches: {
        create: async (params: Params) => {
          claude.batches.push(params);
          return { id: `batch_${claude.batches.length}` };
        },
        retrieve: async (id: string) => ({ id, processing_status: 'in_progress' }),
        results: async function* () {},
      },
    },
  };
}

// The functions only use these as types.
// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace Anthropic {
  namespace Beta.Messages.BatchCreateParams {
    type Request = { params: Params };
  }
}
