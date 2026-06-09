import { standardizeAction } from "./action-dict.js";

export interface OperationChunk {
  sourceText: string;
  parentStep: string;
  action: string;
}

export function splitSopIntoOperationChunks(sopText: string): OperationChunk[] {
  const sentences = normalizeSopText(sopText)
    .split(/[。；;]/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const chunks: OperationChunk[] = [];

  for (const [index, sentence] of sentences.entries()) {
    const parentStep = `步骤 ${index + 1}`;
    chunks.push(...expandSentence(sentence, parentStep));
  }

  return chunks;
}

function normalizeSopText(sopText: string): string {
  return sopText
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, "").replace(/^\s*\d+[.)、]\s*/, "").trim())
    .filter((line) => line && !/^(SOP|Cell Collection SOP)$/i.test(line))
    .join("。");
}

function expandSentence(sentence: string, parentStep: string): OperationChunk[] {
  if (/更换/.test(sentence)) {
    const medium = sentence.match(/更换(.+)/)?.[1].replace(/[。；;]/g, "").trim() || "旧液";
    return [
      makeChunk(`吸去旧${medium}`, parentStep, "吸液"),
      makeChunk(`加入新鲜${medium}`, parentStep, "加液")
    ];
  }

  const wash = sentence.match(/(.+?)\s*洗涤\s*(\d+)\s*次/);
  if (wash) {
    const reagent = wash[1].trim() || "洗液";
    const loopStep = `${parentStep} 循环 ${wash[2]} 次`;
    return [
      makeChunk(`加入 ${reagent}`, loopStep, "加液"),
      makeChunk(`${reagent} 洗涤/混匀`, loopStep, "混匀"),
      makeChunk(`吸去 ${reagent}`, loopStep, "吸液")
    ];
  }

  return sentence
    .split(/，|,|\s+并\s*|\s*随后\s*/)
    .map((fragment) => fragment.trim())
    .filter(Boolean)
    .map((fragment) => makeChunk(fragment, parentStep));
}

function makeChunk(sourceText: string, parentStep: string, action = standardizeAction(sourceText)): OperationChunk {
  return {
    sourceText: sourceText.replace(/\s+/g, " ").trim(),
    parentStep,
    action
  };
}
