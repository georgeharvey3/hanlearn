/**
 * PROTOTYPE, throwaway. Not for main.
 *
 * Question: can a grade that the app sets replace the self-grade of the
 * Comprehend tab? Three variants on one dev-only route, switched by
 * `?variant=A|B|C`:
 *
 * - A "Pick at once": the options show with the sentence. Tap the English.
 * - B "Think, then pick": the options hide until "Show options".
 * - C "Match or not": one English shows. The learner says if it matches.
 *
 * The distractors are the English of the other sentences of the same word, so
 * every option holds the target word. The data is copied from
 * `public/sentences/` (5df2, 4e3a, 5e2e) so the route needs no build output.
 * Nothing is saved: the state panel at the foot shows what a grade would log.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { Box, ButtonBase } from '@mui/material';

import StudyScreen, { StudyBody } from '../../components/Test/Study/StudyScreen';
import { PillToggle, PlayButton, StudyButton, StudyCard } from '../../components/Test/Study/parts';
import { colors, fonts } from '../../theme';
import { TileLog, TileTask, TileVariant } from './TileVariants';
import { TILE_SENTENCES } from './tileData';

// Prototype copy. It stays here so the prototype is one file.
const text = {
  showOptions: 'Show options',
  showText: 'Show text',
  hideText: 'Hide text',
  next: 'Next',
  restart: 'Restart',
  matches: 'Matches',
  noMatch: 'No match',
  pickPrompt: 'What does it mean?',
  matchPrompt: 'Does this match?',
  right: 'Right',
  wrong: 'Wrong',
  audio: 'Audio',
  text: 'Text',
  done: 'Set done',
  state: 'State',
  variantNames: {
    A: 'Pick at once',
    B: 'Think, then pick',
    C: 'Match or not',
    D: 'Build from tiles',
    E: 'Choose each slot',
  } as Record<Variant, string>,
};

type Variant = 'A' | 'B' | 'C' | 'D' | 'E';
const VARIANTS: Variant[] = ['A', 'B', 'C', 'D', 'E'];
const isTile = (v: Variant): v is TileVariant => v === 'D' || v === 'E';

interface Sentence {
  id: string;
  simp: string;
  pinyin: string;
  english: string;
  distractors?: { score: number; simp: string; english: string }[];
}
interface ProtoWord {
  simp: string;
  pinyin: string;
  meaning: string;
  sentences: Sentence[];
}

const WORDS: ProtoWord[] = [
  {
    simp: '已经',
    pinyin: 'yǐ jīng',
    meaning: 'already',
    sentences: [
      {
        id: 'a1',
        simp: '我已经做够了。',
        pinyin: 'wǒ yǐ jīng zuò gòu le',
        english: "I've done enough already.",
      },
      { id: 'a2', simp: '我已经起来了。', pinyin: 'wǒ yǐ jīng qǐ lái le', english: "I'm up." },
      {
        id: 'a3',
        simp: '他已经来了吗？',
        pinyin: 'tā yǐ jīng lái le ma',
        english: 'Has he come yet?',
      },
    ],
  },
  {
    simp: '为了',
    pinyin: 'wèi le',
    meaning: 'in order to; for the purpose of',
    sentences: [
      {
        id: 'b1',
        simp: '那是为了什么？',
        pinyin: 'nà shì wèi le shén me',
        english: 'What was it for?',
      },
      {
        id: 'b2',
        simp: '他们总是为了小事吵架。',
        pinyin: 'tā men zǒng shì wèi le xiǎo shì chǎo jià',
        english: 'They always fight over little things.',
      },
      {
        id: 'b3',
        simp: '这个公园是为了纪念他建的。',
        pinyin: 'zhè ge gōng yuán shì wèi le jì niàn tā jiàn de',
        english: 'This park was built in his memory.',
      },
    ],
  },
  {
    // Kept on purpose: two sentences differ only in 他 / 她, which sound the same.
    simp: '帮助',
    pinyin: 'bāng zhù',
    meaning: 'to help',
    sentences: [
      {
        id: 'c1',
        simp: '你应该帮助她。',
        pinyin: 'nǐ yīng gāi bāng zhù tā',
        english: 'You should help her.',
      },
      {
        id: 'c2',
        simp: '你应该帮助他。',
        pinyin: 'nǐ yīng gāi bāng zhù tā',
        english: 'You should help him.',
      },
      {
        id: 'c3',
        simp: '他们会帮助我们的。',
        pinyin: 'tā men huì bāng zhù wǒ men de',
        english: 'They will help us.',
      },
    ],
  },
];

// HSK 7-9 words. Each sentence carries 3 distractors: corpus sentences with an
// English cosine of 0.60-0.83 (gte-modernbert-base), less any that holds a word
// whose gloss shares a content word with the target gloss. They rank by the
// Chinese content words they share with the sentence, so a recognised word is
// in the distractors too. The number is the cosine.
const HARD_WORDS: ProtoWord[] = [
  {
    simp: '暗中',
    pinyin: 'an4 zhong1',
    meaning: 'in the dark/in secret/on the sly/surreptitiously',
    sentences: [
      {
        id: '9319cd8589',
        simp: '他一直在暗中帮助我。',
        pinyin: 'tā yī zhí zài àn zhōng bāng zhù wǒ',
        english: 'He has been helping me secretly all along.',
        distractors: [
          {
            score: 0.7,
            simp: '纵观他的一生，他一直在帮助别人。',
            english: 'Looking back over his whole life, he was always helping others.',
          },
          { score: 0.75, simp: '他一直与我同在。', english: 'He is always with me.' },
          { score: 0.75, simp: '我获得了好友的帮助。', english: 'I was aided by a dear friend.' },
        ],
      },
      {
        id: 'a2934bf8a0',
        simp: '警察在暗中调查这件事。',
        pinyin: 'jǐng chá zài àn zhōng diào chá zhè jiàn shì',
        english: 'The police are quietly investigating this matter.',
        distractors: [
          {
            score: 0.83,
            simp: '这件事警察已经介入调查了。',
            english: 'The police have already stepped in to investigate this.',
          },
          {
            score: 0.77,
            simp: '检察人员正在调查这件事。',
            english: 'Prosecutors are investigating this matter.',
          },
          {
            score: 0.75,
            simp: '警察一定会把这件事查个水落石出。',
            english: 'The police will definitely get to the bottom of this.',
          },
        ],
      },
      {
        id: 'e3ffd7ad04',
        simp: '这两个人一直在暗中较劲。',
        pinyin: 'zhè liǎng gè rén yī zhí zài àn zhōng jiào jìn',
        english: 'Those two have been secretly competing with each other all along.',
        distractors: [
          {
            score: 0.76,
            simp: '他们两个人之间有了隔阂。',
            english: 'A rift has formed between the two of them.',
          },
          {
            score: 0.75,
            simp: '这两个人的水平不分高低。',
            english: 'These two people are evenly matched.',
          },
          {
            score: 0.74,
            simp: '两个人并列第一名。',
            english: 'The two people tied for first place.',
          },
        ],
      },
    ],
  },
  {
    simp: '霸占',
    pinyin: 'ba4 zhan4',
    meaning: 'to occupy by force/to seize/to dominate',
    sentences: [
      {
        id: '2148c25c84',
        simp: '别霸占着电脑，我也要用。',
        pinyin: 'bié bà zhàn zhe diàn nǎo wǒ yě yào yòng',
        english: "Don't keep the computer to yourself; I need to use it too.",
        distractors: [
          {
            score: 0.73,
            simp: '会用电脑是一个好处。',
            english: 'It is an advantage to be able to use a computer.',
          },
          {
            score: 0.68,
            simp: '你别笑，我对电脑是外行。',
            english: "Don't laugh; I'm a novice when it comes to computers.",
          },
          {
            score: 0.68,
            simp: '我妈妈在夜校学会了用电脑。',
            english: 'My mom learned to use a computer at evening school.',
          },
        ],
      },
      {
        id: '3dcf159f3f',
        simp: '他一个人霸占了整张沙发。',
        pinyin: 'tā yī gè rén bà zhàn le zhěng zhāng shā fā',
        english: 'He hogged the whole sofa to himself.',
        distractors: [
          { score: 0.61, simp: '我们想买张沙发。', english: 'We would like to buy a sofa.' },
          {
            score: 0.76,
            simp: '他累得瘫在沙发上。',
            english: 'He was so tired he collapsed on the sofa.',
          },
          {
            score: 0.7,
            simp: '这个沙发里面是海绵。',
            english: 'This sofa is filled with sponge foam.',
          },
        ],
      },
      {
        id: '0971f9118e',
        simp: '那个地主霸占了农民的土地。',
        pinyin: 'nà gè de zhǔ bà zhàn le nóng mín de tǔ dì',
        english: "That landlord seized the peasants' land.",
        distractors: [
          {
            score: 0.76,
            simp: '他们用低价掠夺农民的土地。',
            english: "They grabbed farmers' land at low prices.",
          },
          {
            score: 0.75,
            simp: '那时候的农民受到了严重的压迫。',
            english: 'Peasants at that time suffered severe oppression.',
          },
          {
            score: 0.73,
            simp: '这片土地被他们占有了很多年。',
            english: 'This land was in their possession for many years.',
          },
        ],
      },
    ],
  },
  {
    simp: '罢免',
    pinyin: 'ba4 mian3',
    meaning: 'to remove sb from their post/to dismiss',
    sentences: [
      {
        id: '58c2f7730e',
        simp: '他因为贪污被罢免了。',
        pinyin: 'tā yīn wèi tān wū bèi bà miǎn le',
        english: 'He was removed from his post for corruption.',
        distractors: [
          {
            score: 0.81,
            simp: '他因为受贿被查处了。',
            english: 'He was investigated and punished for taking bribes.',
          },
          {
            score: 0.79,
            simp: '那位总统因为丑闻被迫下台。',
            english: 'That president was forced to step down because of a scandal.',
          },
          {
            score: 0.76,
            simp: '他因为泄密被开除了。',
            english: 'He was fired for leaking secrets.',
          },
        ],
      },
      {
        id: '6f1d4ca521',
        simp: '董事会决定罢免总经理。',
        pinyin: 'dǒng shì huì jué dìng bà miǎn zǒng jīng lǐ',
        english: 'The board decided to remove the general manager.',
        distractors: [
          {
            score: 0.72,
            simp: '这件事要总经理来决定。',
            english: 'The general manager has to decide on this.',
          },
          {
            score: 0.7,
            simp: '这个决定已经被撤销了。',
            english: 'This decision has been revoked.',
          },
          {
            score: 0.68,
            simp: '公司决定缩小规模。',
            english: 'The company decided to scale down.',
          },
        ],
      },
      {
        id: '88bcf74583',
        simp: '有人要求罢免这名官员。',
        pinyin: 'yǒu rén yāo qiú bà miǎn zhè míng guān yuán',
        english: 'Some people are demanding that this official be dismissed.',
        distractors: [
          {
            score: 0.7,
            simp: '廉政是人民对官员的要求。',
            english: 'Clean government is what the people ask of officials.',
          },
          {
            score: 0.63,
            simp: '那个人劫持了一名人质，要求见记者。',
            english: 'The man took a hostage and demanded to see reporters.',
          },
          {
            score: 0.73,
            simp: '有人在鼓动工人罢工。',
            english: 'Someone is stirring up the workers to strike.',
          },
        ],
      },
    ],
  },
  {
    simp: '爱理不理',
    pinyin: 'ai4 li3 bu4 li3',
    meaning: '(idiom) standoffish; indifferent',
    sentences: [
      {
        id: '7e375659a2',
        simp: '你为什么对我爱理不理的？',
        pinyin: 'nǐ wèi shén me duì wǒ ài lǐ bù lǐ de',
        english: 'Why are you so cold toward me?',
        distractors: [
          { score: 0.81, simp: '你为什么对我这么小气？', english: 'Why are you so mean to me?' },
          { score: 0.79, simp: '你为什么老跟我作对？', english: 'Why are you always against me?' },
          { score: 0.78, simp: '你为什么恨我？', english: 'Why do you hate me?' },
        ],
      },
      {
        id: 'fe181a41cd',
        simp: '我跟他打招呼，他爱理不理的。',
        pinyin: 'wǒ gēn tā dǎ zhāo hu tā ài lǐ bù lǐ de',
        english: 'I said hello to him, but he barely acknowledged me.',
        distractors: [
          {
            score: 0.82,
            simp: '他注意到我在场，但是没向我打招呼。',
            english: "He was aware that I was around, but didn't come to greet me.",
          },
          {
            score: 0.69,
            simp: '跟他说话总是不太投机。',
            english: 'Talking with him never really clicks.',
          },
          { score: 0.68, simp: '他笑着跟我握手。', english: 'He smiled and shook my hand.' },
        ],
      },
      {
        id: '2bd3965b0f',
        simp: '她生气的时候就对人爱理不理。',
        pinyin: 'tā shēng qì de shí hou jiù duì rén ài lǐ bù lǐ',
        english: "When she's angry, she gives people the cold shoulder.",
        distractors: [
          {
            score: 0.63,
            simp: '他虽然生气，但不至于打人。',
            english: "He may be angry, but he wouldn't go so far as to hit anyone.",
          },
          {
            score: 0.77,
            simp: '她很高傲，不爱理人。',
            english: "She's very arrogant and doesn't bother with people.",
          },
          {
            score: 0.74,
            simp: '她说话很有棱角，常常得罪人。',
            english: 'She speaks sharply and often offends people.',
          },
        ],
      },
    ],
  },
  {
    simp: '福气',
    pinyin: 'fu2 qi5',
    meaning: 'good fortune/a blessing',
    sentences: [
      {
        id: 'a70685706d',
        simp: '能吃是福气。',
        pinyin: 'néng chī shì fú qi',
        english: 'Having a good appetite is a blessing.',
        distractors: [
          { score: 0.7, simp: '我什么都能吃。', english: 'I can eat anything.' },
          {
            score: 0.67,
            simp: '回到家就能吃上热腾腾的饭菜。',
            english: 'When I get home I can eat a steaming hot meal.',
          },
          {
            score: 0.77,
            simp: '看到那么多好吃的，我忍不住又吃了一块。',
            english: "Seeing so much good food, I couldn't help having another piece.",
          },
        ],
      },
      {
        id: 'ec9f90091c',
        simp: '我可没那个福气。',
        pinyin: 'wǒ kě méi nà gè fú qi',
        english: "I'm not that lucky.",
        distractors: [
          {
            score: 0.73,
            simp: '我可不像你一样容易被打动。',
            english: "I'm not as easily impressed as you are.",
          },
          { score: 0.71, simp: '我可没有那闲空。', english: "I don't have that kind of time." },
          { score: 0.67, simp: '那可真罕见啊。', english: "It's really rare." },
        ],
      },
      {
        id: 'e5e4b42a1e',
        simp: '老人说孩子长得有福气。',
        pinyin: 'lǎo rén shuō hái zi cháng de yǒu fú qi',
        english: "The old lady said the child looks like he'll be blessed with good fortune.",
        distractors: [
          {
            score: 0.6,
            simp: '临死前，老人与孩子们一一诀别。',
            english: 'Before he died, the old man said farewell to each of his children.',
          },
          { score: 0.75, simp: '老人有一张慈祥的脸。', english: 'The old man has a kindly face.' },
          {
            score: 0.74,
            simp: '看到孩子进步，妈妈很欣喜。',
            english: 'Mom was delighted to see her child improve.',
          },
        ],
      },
    ],
  },
  {
    simp: '不服气',
    pinyin: 'bu4 fu2 qi4',
    meaning: 'unwilling to concede/defiant/indignant/to find it galling',
    sentences: [
      {
        id: '15d41f8bc3',
        simp: '我说他错了，他还不服气。',
        pinyin: 'wǒ shuō tā cuò le tā hái bù fú qì',
        english: "I said he was wrong, and he still wouldn't accept it.",
        distractors: [
          { score: 0.74, simp: '坦率地说，他错了。', english: 'Frankly speaking, he is wrong.' },
          {
            score: 0.73,
            simp: '请你指出我说错的地方。',
            english: 'Please point out where I said something wrong.',
          },
          {
            score: 0.72,
            simp: '事后他才知道自己错了。',
            english: 'Only afterwards did he realize he was wrong.',
          },
        ],
      },
      {
        id: 'fdc89a56ca',
        simp: '她不服气地看了我一眼。',
        pinyin: 'tā bù fú qì de kàn le wǒ yī yǎn',
        english: 'She gave me a defiant look.',
        distractors: [
          { score: 0.79, simp: '他凶狠地看了我一眼。', english: 'He gave me a fierce look.' },
          { score: 0.77, simp: '她不经意地看了我一眼。', english: 'She glanced at me casually.' },
          { score: 0.72, simp: '他轻蔑地看了我一眼。', english: 'He gave me a contemptuous look.' },
        ],
      },
      {
        id: '8689d39a7b',
        simp: '弟弟被批评了，一脸不服气。',
        pinyin: 'dì di bèi pī píng le yī liǎn bù fú qì',
        english: 'My younger brother was told off and looked defiant.',
        distractors: [
          {
            score: 0.76,
            simp: '小时候我常和弟弟吵嘴。',
            english: 'When I was little I often bickered with my younger brother.',
          },
          { score: 0.72, simp: '他脸上带着冷笑。', english: 'He had a sneer on his face.' },
          { score: 0.72, simp: '我弟弟非常调皮。', english: 'My younger brother is very naughty.' },
        ],
      },
    ],
  },
  {
    simp: '描绘',
    pinyin: 'miao2 hui4',
    meaning: 'to describe; to depict; to portray',
    sentences: [
      {
        id: 'ac58ae70b8',
        simp: '这幅画描绘了乡下的生活。',
        pinyin: 'zhè fú huà miáo huì le xiāng xia de shēng huó',
        english: 'This painting depicts life in the countryside.',
        distractors: [
          {
            score: 0.81,
            simp: '墙上悬挂着一幅山水画。',
            english: 'A landscape painting hangs on the wall.',
          },
          { score: 0.77, simp: '是一幅漂亮的画。', english: "It's a beautiful painting." },
          {
            score: 0.77,
            simp: '这幅画的颜色很有层次。',
            english: 'The colours in this painting have a lot of depth.',
          },
        ],
      },
      {
        id: '9c83da5d19',
        simp: '他向我们描绘了未来的计划。',
        pinyin: 'tā xiàng wǒ men miáo huì le wèi lái de jì huà',
        english: 'He described his plans for the future to us.',
        distractors: [
          {
            score: 0.82,
            simp: '他给我们做了详尽的计划。',
            english: 'He made a thorough plan for us.',
          },
          {
            score: 0.77,
            simp: '大家畅谈对未来的打算。',
            english: 'Everyone talked freely about their plans for the future.',
          },
          {
            score: 0.76,
            simp: '你对未来有什么规划？',
            english: 'What plans do you have for the future?',
          },
        ],
      },
      {
        id: 'cd3370a084',
        simp: '小说把那个时代描绘得很真实。',
        pinyin: 'xiǎo shuō bǎ nà gè shí dài miáo huì de hěn zhēn shí',
        english: 'The novel portrays that era very realistically.',
        distractors: [
          {
            score: 0.8,
            simp: '这本小说写得非常生动。',
            english: 'This novel is written very vividly.',
          },
          {
            score: 0.75,
            simp: '这本小说的故事扣人心弦。',
            english: 'The story of this novel is gripping.',
          },
          { score: 0.73, simp: '这本小说写得引人入胜。', english: 'This novel is gripping.' },
        ],
      },
    ],
  },
  {
    simp: '离谱儿',
    pinyin: 'li2 pu3 r5',
    meaning: 'inappropriate; improper; out of place',
    sentences: [
      {
        id: '249208fc45',
        simp: '这个错误真离谱儿。',
        pinyin: 'zhè gè cuò wù zhēn lí pǔ r',
        english: 'This mistake is really absurd.',
        distractors: [
          {
            score: 0.75,
            simp: '句子里有一个错误。',
            english: 'There is a mistake in the sentence.',
          },
          {
            score: 0.72,
            simp: '他们的做法真是骇人听闻。',
            english: 'What they did is truly appalling.',
          },
          {
            score: 0.71,
            simp: '这个问题真是莫名其妙。',
            english: 'This question is really baffling.',
          },
        ],
      },
      {
        id: '9f736377b7',
        simp: '天气预报错得离谱儿。',
        pinyin: 'tiān qì yù bào cuò de lí pǔ r',
        english: 'The weather forecast was wildly wrong.',
        distractors: [
          {
            score: 0.78,
            simp: '天气预报说要下雨，果然下雨了。',
            english: 'The weather forecast said it would rain, and sure enough, it rained.',
          },
          {
            score: 0.76,
            simp: '天气预报说要下雨，我们据此改了计划。',
            english: 'The forecast said it would rain, so we changed our plans accordingly.',
          },
          {
            score: 0.73,
            simp: '现在是天气预报的时间。',
            english: "Now it's time for the weather forecast.",
          },
        ],
      },
      {
        id: '3bbcd27df8',
        simp: '这价钱也太离谱儿了吧！',
        pinyin: 'zhè jià qian yě tài lí pǔ r le ba',
        english: 'This price is way too outrageous!',
        distractors: [
          {
            score: 0.72,
            simp: '这件衣服卖一千块，未免太贵了。',
            english: 'A thousand yuan for this piece of clothing is really too expensive.',
          },
          {
            score: 0.69,
            simp: '价格太高，消费者不愿意买。',
            english: "The price is too high, so consumers won't buy.",
          },
          { score: 0.69, simp: '这里的房租太贵了。', english: 'The rent here is too expensive.' },
        ],
      },
    ],
  },
  {
    simp: '开启',
    pinyin: 'kai1 qi3',
    meaning:
      'to start; to begin; to initiate (an era, process, journey etc)/(computing) to enable (a feature)/(of a system or device) to start operating automatically; to self-initiate/to open (sth that has been sealed)',
    sentences: [
      {
        id: '08743c2e22',
        simp: '大学毕业后，他开启了新的生活。',
        pinyin: 'dà xué bì yè hòu tā kāi qǐ le xīn de shēng huó',
        english: 'After graduating from university, he began a new life.',
        distractors: [
          {
            score: 0.82,
            simp: '他大学毕业后在上海定居了。',
            english: 'After graduating from university, he settled in Shanghai.',
          },
          {
            score: 0.81,
            simp: '大学毕业后，他下乡当了老师。',
            english: 'After graduating from university, he went to the countryside to teach.',
          },
          {
            score: 0.8,
            simp: '大学毕业后，他在上海落户了。',
            english: 'After university, he settled in Shanghai.',
          },
        ],
      },
      {
        id: 'c9f093d120',
        simp: '望远镜为我们的文明开启了一种全新的视角来观察宇宙。',
        pinyin:
          'wàng yuǎn jìng wèi wǒ men de wén míng kāi qǐ le yī zhǒng quán xīn de shì jiǎo lái guān chá yǔ zhòu',
        english:
          'The telescope has opened a new eye onto the cosmos that has been transformative for our civilization.',
        distractors: [
          {
            score: 0.77,
            simp: '你可以用望远镜看星星。',
            english: 'You can use a telescope to look at the stars.',
          },
          {
            score: 0.75,
            simp: '他用望远镜找到了那个星座。',
            english: 'He found that constellation with a telescope.',
          },
          {
            score: 0.69,
            simp: '和宇宙比起来，地球非常渺小。',
            english: 'Compared with the universe, the earth is tiny.',
          },
        ],
      },
      {
        id: 'b75deaae2c',
        simp: '我们很高兴能再次推出这款游戏，并为系列作品开启全新的阶段。',
        pinyin:
          'wǒ men hěn gāo xìng néng zài cì tuī chū zhè kuǎn yóu xì bìng wèi xì liè zuò pǐn kāi qǐ quán xīn de jiē duàn',
        english:
          "We're delighted to bring this game back for the start of a new era for the series.",
        distractors: [
          {
            score: 0.7,
            simp: '在多款体育类模拟游戏陆续登场后，这款作品为热爱球类运动的玩家带来更真实的管理体验。',
            english:
              'Following a wave of other recent sports simulations, this release offers ball game fans a more authentic management experience.',
          },
          {
            score: 0.72,
            simp: '多款经典家庭游戏也将于下个月同步上架。',
            english:
              'Several classic, family-friendly games will also join the service next month.',
          },
          {
            score: 0.71,
            simp: '新作采用升级版图形引擎，呈现更流畅的动作与更细致的场景，并提供多样的比赛模式与球员管理功能，使游戏更贴近真实世界的竞技环境。',
            english:
              'Featuring an upgraded graphics engine with smoother movement, detailed environments, and varied competition modes and player-management features, the new title closely mirrors real-world competition.',
          },
        ],
      },
    ],
  },
  {
    simp: '罐头',
    pinyin: 'guan4 tou5',
    meaning: 'tin/can',
    sentences: [
      {
        id: '544c5aaaeb',
        simp: '我构不到那罐番茄罐头。',
        pinyin: 'wǒ gòu bù dào nà guàn fān qié guàn tou',
        english: "I can't reach that can of tomatoes.",
        distractors: [
          {
            score: 0.75,
            simp: '番茄是蔬菜而不是水果。',
            english: 'The tomato is a vegetable, not a fruit.',
          },
          { score: 0.7, simp: '我做不到，长官。', english: "I can't do that, sir." },
          { score: 0.67, simp: '我找不到扫把了。', english: "I can't find the broom." },
        ],
      },
      {
        id: '9ec59a0c10',
        simp: '罐头的保质期一般很长。',
        pinyin: 'guàn tou de bǎo zhì qī yī bān hěn cháng',
        english: 'Canned food usually has a long shelf life.',
        distractors: [
          {
            score: 0.69,
            simp: '买牛奶时要看保质期。',
            english: 'When buying milk, check the shelf life.',
          },
          {
            score: 0.69,
            simp: '这瓶酱油已经过了保质期。',
            english: 'This bottle of soy sauce is past its use-by date.',
          },
          { score: 0.64, simp: '人无法长生不死。', english: "People can't live forever." },
        ],
      },
      {
        id: 'ad4ae08d0d',
        simp: '他打开一个鱼罐头当晚饭。',
        pinyin: 'tā dǎ kāi yī gè yú guàn tou dāng wǎn fàn',
        english: 'He opened a tin of fish for dinner.',
        distractors: [
          { score: 0.82, simp: '昨天的晚餐是鱼。', english: "Yesterday's dinner was fish." },
          { score: 0.77, simp: '他用面包当诱饵钓鱼。', english: 'He used bread as bait to fish.' },
          { score: 0.76, simp: '这鱼吃着像三文鱼。', english: 'The fish tasted like salmon.' },
        ],
      },
    ],
  },
  {
    simp: '非金属',
    pinyin: 'fei1 jin1 shu3',
    meaning: 'nonmetal (chemistry)',
    sentences: [
      {
        id: 'd42b2a0732',
        simp: '非金属一般不导电。',
        pinyin: 'fēi jīn shǔ yī bān bù dǎo diàn',
        english: "Nonmetals generally don't conduct electricity.",
        distractors: [
          {
            score: 0.68,
            simp: '电线老了，很容易发火。',
            english: 'Old wires can easily catch fire.',
          },
          {
            score: 0.68,
            simp: '酸性会腐蚀含有金属的物质。',
            english: 'Acid acts on things which contain metal.',
          },
          {
            score: 0.68,
            simp: '水的特性之一是没有颜色。',
            english: 'One of the properties of water is that it has no colour.',
          },
        ],
      },
      {
        id: 'fa114ad00c',
        simp: '碳是一种常见的非金属。',
        pinyin: 'tàn shì yī zhǒng cháng jiàn de fēi jīn shǔ',
        english: 'Carbon is a common nonmetal.',
        distractors: [
          {
            score: 0.65,
            simp: '豆腐是一种常见的豆制品。',
            english: 'Tofu is a common soy product.',
          },
          {
            score: 0.73,
            simp: '这种材料是由多种东西合成的。',
            english: 'This material is made up of several substances.',
          },
          {
            score: 0.7,
            simp: '每种材料都有自己的特性。',
            english: 'Every material has its own properties.',
          },
        ],
      },
      {
        id: '35389a4655',
        simp: '木头和塑料都是非金属材料。',
        pinyin: 'mù tou hé sù liào dōu shì fēi jīn shǔ cái liào',
        english: 'Wood and plastic are both nonmetal materials.',
        distractors: [
          { score: 0.76, simp: '所有的玩具都是木头做的。', english: 'All of the toys are wooden.' },
          {
            score: 0.75,
            simp: '这种材料是由多种东西合成的。',
            english: 'This material is made up of several substances.',
          },
          {
            score: 0.74,
            simp: '这种塑料的特性是很轻。',
            english: "The key property of this plastic is that it's light.",
          },
        ],
      },
    ],
  },
  {
    simp: '独唱',
    pinyin: 'du2 chang4',
    meaning: '(in singing) solo/to solo',
    sentences: [
      {
        id: '4b2a1b4412',
        simp: '晚会上她表演了一首独唱。',
        pinyin: 'wǎn huì shàng tā biǎo yǎn le yī shǒu dú chàng',
        english: 'She sang a solo at the evening party.',
        distractors: [
          {
            score: 0.82,
            simp: '她在晚会上朗诵了一首诗。',
            english: 'She recited a poem at the evening party.',
          },
          {
            score: 0.73,
            simp: '晚会上有乐队表演。',
            english: 'There is a band playing at the party.',
          },
          {
            score: 0.65,
            simp: '今年的联欢晚会你会表演节目吗？',
            english: "Will you perform at this year's gala evening?",
          },
        ],
      },
      {
        id: '7c7bd4694d',
        simp: '第一次独唱，我紧张得发抖。',
        pinyin: 'dì yī cì dú chàng wǒ jǐn zhāng de fā dǒu',
        english: 'The first time I sang solo, I was shaking with nerves.',
        distractors: [
          {
            score: 0.79,
            simp: '她第一次站上舞台，非常紧张。',
            english: 'The first time she stood on stage, she was very nervous.',
          },
          {
            score: 0.69,
            simp: '第一次带队，她有点紧张。',
            english: 'It was her first time leading a team, and she was a bit nervous.',
          },
          {
            score: 0.82,
            simp: '第一次上台，我有点儿慌张。',
            english: 'The first time on stage, I was a bit nervous.',
          },
        ],
      },
      {
        id: '8e01db4168',
        simp: '音乐会上有三个独唱节目。',
        pinyin: 'yīn yuè huì shàng yǒu sān gè dú chàng jié mù',
        english: 'There are three solo pieces in the concert.',
        distractors: [
          {
            score: 0.72,
            simp: '音乐会明天晚上举行。',
            english: 'The concert will be held tomorrow evening.',
          },
          {
            score: 0.7,
            simp: '这场音乐会在网上同时转播。',
            english: 'This concert is being streamed online at the same time.',
          },
          { score: 0.7, simp: '音乐会很成功。', english: 'The concert was a success.' },
        ],
      },
    ],
  },
  {
    simp: '喜酒',
    pinyin: 'xi3 jiu3',
    meaning: 'wedding feast/liquor drunk at a wedding feast',
    sentences: [
      {
        id: '77ebc576d7',
        simp: '村里摆了三天喜酒。',
        pinyin: 'cūn lǐ bǎi le sān tiān xǐ jiǔ',
        english: 'The village held a wedding feast for three days.',
        distractors: [
          {
            score: 0.76,
            simp: '村里到处喜洋洋，像过节一样。',
            english: 'The whole village was joyful, as if it were a festival.',
          },
          {
            score: 0.76,
            simp: '村里每年都会举行祭祀活动。',
            english: 'The village holds a sacrificial ceremony every year.',
          },
          {
            score: 0.74,
            simp: '这个老节日在村里又复活了。',
            english: 'This old festival has been revived in the village.',
          },
        ],
      },
      {
        id: '82cf062c28',
        simp: '他在喜酒上喝多了。',
        pinyin: 'tā zài xǐ jiǔ shàng hē duō le',
        english: 'He drank too much at the wedding feast.',
        distractors: [
          {
            score: 0.6,
            simp: '喝了太多咖啡，我有点心慌。',
            english: 'I drank too much coffee and my heart is racing a bit.',
          },
          {
            score: 0.73,
            simp: '他结婚那天，请了很多亲朋好友。',
            english: 'On his wedding day, he invited lots of friends and family.',
          },
          {
            score: 0.73,
            simp: '喝醉以后，他露出了本性。',
            english: 'Once drunk, he showed his true nature.',
          },
        ],
      },
      {
        id: '260cdf2fdf',
        simp: '我这周末没空，要去吃喜酒。',
        pinyin: 'wǒ zhè zhōu mò méi kōng yào qù chī xǐ jiǔ',
        english: "I'm not free this weekend because I'm going to a wedding.",
        distractors: [
          {
            score: 0.65,
            simp: '她试探着问我周末有没有空。',
            english: 'She tentatively asked whether I was free at the weekend.',
          },
          {
            score: 0.64,
            simp: '周末我们去朋友家作客。',
            english: "This weekend we're going to visit a friend's home.",
          },
          {
            score: 0.64,
            simp: '周末我们去看画展吧。',
            english: "Let's go to the art exhibition at the weekend.",
          },
        ],
      },
    ],
  },
  {
    simp: '沧桑',
    pinyin: 'cang1 sang1',
    meaning:
      'great changes/ups and downs/vicissitudes/lit. the blue sea turned into mulberry fields (idiom)/fig. the transformations of the world',
    sentences: [
      {
        id: 'ca1e0a21cc',
        simp: '他的脸上写满了沧桑。',
        pinyin: 'tā de liǎn shàng xiě mǎn le cāng sāng',
        english: 'His face shows the marks of a hard life.',
        distractors: [
          { score: 0.8, simp: '他的脸上满是泥。', english: 'His face was covered with mud.' },
          {
            score: 0.78,
            simp: '他的喜怒哀乐都写在脸上。',
            english: 'All his feelings show on his face.',
          },
          { score: 0.65, simp: '他因为发烧而满脸通红。', english: 'Fever flushed his cheeks.' },
        ],
      },
      {
        id: '437411ce8b',
        simp: '老人的声音里带着沧桑。',
        pinyin: 'lǎo rén de shēng yīn lǐ dài zhe cāng sāng',
        english: "There was a weariness of the world in the old man's voice.",
        distractors: [
          { score: 0.7, simp: '他在戏里扮一个老人。', english: 'He plays an old man in the play.' },
          {
            score: 0.67,
            simp: '老人被困在电梯里，用手机呼救。',
            english: 'The old man was trapped in the lift and called for help on his phone.',
          },
          {
            score: 0.66,
            simp: '老人俯首在地里干活。',
            english: 'The old man was bent over working in the field.',
          },
        ],
      },
      {
        id: 'eb3ef812ca',
        simp: '这座老房子经历了百年沧桑。',
        pinyin: 'zhè zuò lǎo fáng zi jīng lì le bǎi nián cāng sāng',
        english: 'This old house has seen a hundred years of change.',
        distractors: [
          {
            score: 0.77,
            simp: '工人们花了一年时间修复这座古老的房子。',
            english: 'The workers spent a year restoring this old house.',
          },
          {
            score: 0.76,
            simp: '那座老房子已经摇摇欲坠了。',
            english: 'That old house is already on the verge of collapse.',
          },
          {
            score: 0.75,
            simp: '老街上积淀着几百年的历史。',
            english: 'The old street holds centuries of history.',
          },
        ],
      },
    ],
  },
  {
    simp: '彩电',
    pinyin: 'cai3 dian4',
    meaning: 'color TV',
    sentences: [
      {
        id: '45cdec50f5',
        simp: '我家买了一台新彩电。',
        pinyin: 'wǒ jiā mǎi le yī tái xīn cǎi diàn',
        english: 'My family bought a new colour TV.',
        distractors: [
          {
            score: 0.61,
            simp: '我们的新家有一台电梯。',
            english: 'We have an elevator in our new house.',
          },
          {
            score: 0.74,
            simp: '我买了一个新的电脑显示器。',
            english: 'I bought a new computer monitor.',
          },
          {
            score: 0.69,
            simp: '新家里的电器都买齐了。',
            english: "We've bought all the appliances for the new home.",
          },
        ],
      },
      {
        id: 'ef346b582a',
        simp: '八十年代，彩电还很贵。',
        pinyin: 'bā shí nián dài cǎi diàn hái hěn guì',
        english: 'In the eighties, colour TVs were still expensive.',
        distractors: [
          {
            score: 0.69,
            simp: '这是八十年代的老照片。',
            english: 'This is an old photo from the eighties.',
          },
          {
            score: 0.66,
            simp: '贵的东西未必好。',
            english: "Expensive things aren't necessarily good.",
          },
          { score: 0.66, simp: '这块宝石很贵。', english: 'This gem is very expensive.' },
        ],
      },
      {
        id: '18b7c8ac2b',
        simp: '这台彩电用了十几年了。',
        pinyin: 'zhè tái cǎi diàn yòng le shí jǐ nián le',
        english: 'This colour TV has been in use for over ten years.',
        distractors: [
          {
            score: 0.61,
            simp: '这家老店在街上屹立了几十年。',
            english: 'This old shop has stood on the street for decades.',
          },
          {
            score: 0.73,
            simp: '这家饭馆运营了十年。',
            english: 'This restaurant has been running for ten years.',
          },
          { score: 0.71, simp: '一晃十年过去了。', english: 'Ten years have gone by in a flash.' },
        ],
      },
    ],
  },
  {
    simp: '恩怨',
    pinyin: 'en1 yuan4',
    meaning: 'gratitude and grudges/resentment/grudges/grievances',
    sentences: [
      {
        id: 'e5dde1ee49',
        simp: '过去的恩怨就算了吧。',
        pinyin: 'guò qù de ēn yuàn jiù suàn le ba',
        english: "Let's forget about past grievances.",
        distractors: [
          {
            score: 0.76,
            simp: '我们应该抛开过去，向前看。',
            english: 'We should leave the past behind and look forward.',
          },
          { score: 0.74, simp: '别太执着于过去了。', english: "Don't cling to the past so much." },
          {
            score: 0.7,
            simp: '别再留恋过去了，往前看吧。',
            english: 'Stop clinging to the past and look ahead.',
          },
        ],
      },
      {
        id: '008dd003de',
        simp: '他不想再管这些恩怨了。',
        pinyin: 'tā bù xiǎng zài guǎn zhè xiē ēn yuàn le',
        english: "He doesn't want to get involved in these old scores any more.",
        distractors: [
          { score: 0.69, simp: '我不想再哀求他了。', english: "I don't want to beg him any more." },
          {
            score: 0.65,
            simp: '我不想再惹事了。',
            english: "I don't want to cause any more trouble.",
          },
          {
            score: 0.64,
            simp: '我不想再和他们联系了。',
            english: "I don't want to contact them anymore.",
          },
        ],
      },
      {
        id: '406d32cfda',
        simp: '两家人的恩怨已经很多年了。',
        pinyin: 'liǎng jiā rén de ēn yuàn yǐ jīng hěn duō nián le',
        english: 'The feud between the two families has gone on for many years.',
        distractors: [
          {
            score: 0.69,
            simp: '这两个国家是多年的盟友。',
            english: 'These two countries have been allies for many years.',
          },
          {
            score: 0.65,
            simp: '这个剧目已经演了二十多年。',
            english: 'This play has been running for more than twenty years.',
          },
          {
            score: 0.63,
            simp: '两位老同学分别多年后终于会面了。',
            english: 'The two old classmates finally met again after many years apart.',
          },
        ],
      },
    ],
  },
  {
    simp: '距',
    pinyin: 'ju4',
    meaning:
      'to be at a distance of ... from; to be apart from/(bound form) distance/spur (on the leg of certain birds: gamecock, pheasant etc)',
    sentences: [
      {
        id: '883fe40eef',
        simp: '距考试只有三天了。',
        pinyin: 'jù kǎo shì zhǐ yǒu sān tiān le',
        english: 'There are only three days left until the exam.',
        distractors: [
          {
            score: 0.82,
            simp: '考试前他突击复习了三天。',
            english: 'He crammed for three days before the exam.',
          },
          { score: 0.76, simp: '车票有效三天。', english: 'The ticket holds good for three days.' },
          { score: 0.75, simp: '考试地点在三楼。', english: 'The exam is on the third floor.' },
        ],
      },
      {
        id: 'fc260da0cb',
        simp: '这个村子距城市很远。',
        pinyin: 'zhè gè cūn zǐ jù chéng shì hěn yuǎn',
        english: 'This village is a long way from the city.',
        distractors: [
          {
            score: 0.79,
            simp: '这个村子还没有连上电网。',
            english: "This village isn't connected to the power grid yet.",
          },
          {
            score: 0.79,
            simp: '我们住在城市的边缘，离市中心很远。',
            english: 'We live on the edge of the city, far from the center.',
          },
          {
            score: 0.78,
            simp: '村子在高山脚下。',
            english: 'The village is at the foot of a high mountain.',
          },
        ],
      },
      {
        id: '2631bcfbc8',
        simp: '保持车距可以避免追尾。',
        pinyin: 'bǎo chí chē jù kě yǐ bì miǎn zhuī wěi',
        english: 'Keeping a safe distance can prevent rear-end collisions.',
        distractors: [
          {
            score: 0.78,
            simp: '下雨天开车要小心追尾。',
            english: 'When driving in the rain, watch out for rear-end collisions.',
          },
          {
            score: 0.77,
            simp: '两辆车之间要留出足够的间隙。',
            english: 'Leave enough space between the two cars.',
          },
          { score: 0.76, simp: '车别开得那么近。', english: "Don't drive that close to it." },
        ],
      },
    ],
  },
  {
    simp: '扣人心弦',
    pinyin: 'kou4 ren2 xin1 xian2',
    meaning: 'to excite/to thrill/exciting/thrilling/cliff-hanging',
    sentences: [
      {
        id: '7685657a80',
        simp: '电影的结尾扣人心弦。',
        pinyin: 'diàn yǐng de jié wěi kòu rén xīn xián',
        english: 'The ending of the film is gripping.',
        distractors: [
          {
            score: 0.76,
            simp: '我不喜欢这部电影的结尾。',
            english: "I don't like the ending of this film.",
          },
          {
            score: 0.81,
            simp: '这部电影的悬念一直到最后才解开。',
            english: "The suspense in this film isn't resolved until the very end.",
          },
          {
            score: 0.8,
            simp: '这本小说的结尾很感人。',
            english: 'The ending of this novel is very moving.',
          },
        ],
      },
      {
        id: '6908a1c044',
        simp: '这场比赛真是扣人心弦。',
        pinyin: 'zhè chǎng bǐ sài zhēn shì kòu rén xīn xián',
        english: 'This match was really thrilling.',
        distractors: [
          {
            score: 0.82,
            simp: '比赛的结果真是意想不到。',
            english: 'The result of the match was really unexpected.',
          },
          {
            score: 0.82,
            simp: '很多人收看了这场比赛。',
            english: 'Many people watched this match.',
          },
          {
            score: 0.81,
            simp: '这场比赛很值得观摩学习。',
            english: 'This match is well worth watching and learning from.',
          },
        ],
      },
      {
        id: '5505c2406a',
        simp: '这本小说的故事扣人心弦。',
        pinyin: 'zhè běn xiǎo shuō de gù shi kòu rén xīn xián',
        english: 'The story of this novel is gripping.',
        distractors: [
          {
            score: 0.83,
            simp: '这本小说写得非常生动。',
            english: 'This novel is written very vividly.',
          },
          {
            score: 0.78,
            simp: '那本小说的作者是谁呢？',
            english: 'Who is the author of the novel?',
          },
          {
            score: 0.76,
            simp: '这本小说是一部世界名著。',
            english: 'This novel is a world masterpiece.',
          },
        ],
      },
    ],
  },
  {
    simp: '真心',
    pinyin: 'zhen1 xin1',
    meaning: 'wholeheartedness; sincerity',
    sentences: [
      {
        id: '0699fd4286',
        simp: '我不相信他是真心的。',
        pinyin: 'wǒ bù xiāng xìn tā shì zhēn xīn de',
        english: "I don't think that he is sincere.",
        distractors: [
          {
            score: 0.79,
            simp: '他说得太玄了，我不太相信。',
            english: "What he said is too far-fetched; I don't really believe it.",
          },
          {
            score: 0.74,
            simp: '别相信他，他是个奸诈的人。',
            english: "Don't trust him; he's a treacherous person.",
          },
          {
            score: 0.73,
            simp: '他是个黑心的人，不能相信。',
            english: "He's a ruthless person and can't be trusted.",
          },
        ],
      },
      {
        id: '2841859965',
        simp: '这次座谈大家说了很多真心话。',
        pinyin: 'zhè cì zuò tán dà jiā shuō le hěn duō zhēn xīn huà',
        english: 'Everyone spoke frankly at this discussion.',
        distractors: [
          {
            score: 0.69,
            simp: '这次调查是匿名的，大家可以说真话。',
            english: 'This survey is anonymous, so everyone can tell the truth.',
          },
          {
            score: 0.74,
            simp: '这次会晤谈了很多重要问题。',
            english: 'Many important issues were discussed at this meeting.',
          },
          {
            score: 0.7,
            simp: '这次活动大家都是自愿参加的。',
            english: 'Everyone took part in this event voluntarily.',
          },
        ],
      },
      {
        id: '601cd09cb0',
        simp: '大家帮我这么大的忙，真心向大家道谢。',
        pinyin: 'dà jiā bāng wǒ zhè me dà de máng zhēn xīn xiàng dà jiā dào xiè',
        english: "You have helped me so much, I'd like to express my sincere gratitude.",
        distractors: [
          {
            score: 0.63,
            simp: '别那么目中无人，大家都在帮你。',
            english: "Don't be so arrogant; everyone is helping you.",
          },
          {
            score: 0.61,
            simp: '她诚恳地向大家道歉。',
            english: 'She sincerely apologized to everyone.',
          },
          {
            score: 0.61,
            simp: '咱们是老朋友，帮这点忙没说的。',
            english: "We're old friends; helping with this is no problem at all.",
          },
        ],
      },
    ],
  },
  {
    simp: '不相上下',
    pinyin: 'bu4 xiang1 shang4 xia4',
    meaning: 'equally matched/about the same',
    sentences: [
      {
        id: '36d0b983a7',
        simp: '他们俩的成绩不相上下。',
        pinyin: 'tā men liǎ de chéng jì bù xiāng shàng xià',
        english: 'The two of them have about equal grades.',
        distractors: [
          {
            score: 0.77,
            simp: '她在班里成绩中等。',
            english: 'Her grades are average for her class.',
          },
          {
            score: 0.77,
            simp: '他的成绩仅次于班长。',
            english: "His grades are second only to the class monitor's.",
          },
          {
            score: 0.77,
            simp: '他们俩年龄和性格都很匹配。',
            english: 'The two of them are well matched in age and personality.',
          },
        ],
      },
      {
        id: '3ad3325796',
        simp: '兄弟俩的个子不相上下。',
        pinyin: 'xiōng dì liǎ de gè zi bù xiāng shàng xià',
        english: 'The two brothers are about the same height.',
        distractors: [
          {
            score: 0.77,
            simp: '兄弟俩的性格截然不同。',
            english: 'The two brothers have completely different personalities.',
          },
          {
            score: 0.69,
            simp: '吵了一个月，兄弟俩终于和解了。',
            english: 'After a month of arguing, the two brothers finally made up.',
          },
          { score: 0.76, simp: '他们是兄弟吗？', english: 'Are they brothers?' },
        ],
      },
      {
        id: 'f786a5bebd',
        simp: '两个队的水平不相上下。',
        pinyin: 'liǎng gè duì de shuǐ píng bù xiāng shàng xià',
        english: 'The two teams are evenly matched.',
        distractors: [
          {
            score: 0.83,
            simp: '两个队在争夺冠军。',
            english: 'The two teams are fighting for the championship.',
          },
          {
            score: 0.72,
            simp: '我们队现在领先两分。',
            english: 'Our team is now leading by two points.',
          },
          { score: 0.7, simp: '两队还没分出胜负。', english: 'Neither team has won yet.' },
        ],
      },
    ],
  },
  {
    simp: '接班人',
    pinyin: 'jie1 ban1 ren2',
    meaning: 'successor',
    sentences: [
      {
        id: '4ed33f55a5',
        simp: '这门手艺没有接班人了。',
        pinyin: 'zhè mén shǒu yì méi yǒu jiē bān rén le',
        english: 'There is no one left to carry on this craft.',
        distractors: [
          {
            score: 0.72,
            simp: '这种手艺快要失传了。',
            english: 'This craft is close to dying out.',
          },
          {
            score: 0.69,
            simp: '这门传统技艺快要失传了。',
            english: 'This traditional craft is about to be lost.',
          },
          {
            score: 0.63,
            simp: '公司关门了，大家只好各奔前程。',
            english: 'The company closed, so everyone had to go their own way.',
          },
        ],
      },
      {
        id: 'ec414721e5',
        simp: '孩子们是国家的接班人。',
        pinyin: 'hái zi men shì guó jiā de jiē bān rén',
        english: "Children are the nation's successors.",
        distractors: [
          {
            score: 0.73,
            simp: '孩子们在学校学会了唱国歌。',
            english: 'The children learned to sing the national anthem at school.',
          },
          {
            score: 0.71,
            simp: '孩子们的成长有很多共性。',
            english: "Children's development has a lot in common.",
          },
          {
            score: 0.71,
            simp: '孩子们在游戏里也会结同盟。',
            english: 'Children also form alliances in their games.',
          },
        ],
      },
      {
        id: '9be28a0ffa',
        simp: '老板一直在找自己的接班人。',
        pinyin: 'lǎo bǎn yī zhí zài zhǎo zì jǐ de jiē bān rén',
        english: 'The boss has been looking for his successor.',
        distractors: [
          {
            score: 0.66,
            simp: '他去找老板加工资，结果碰钉子了。',
            english: 'He went to ask his boss for a raise but was turned down flat.',
          },
          {
            score: 0.64,
            simp: '公司老板一直没有出面。',
            english: "The company's boss never showed his face.",
          },
          {
            score: 0.63,
            simp: '老板一直给我们施压，要求加班。',
            english: 'The boss keeps pressuring us to work overtime.',
          },
        ],
      },
    ],
  },
  {
    simp: '物流',
    pinyin: 'wu4 liu2',
    meaning: 'distribution (business)/logistics',
    sentences: [
      {
        id: '2fee62f808',
        simp: '下雪了，物流可能会慢一点。',
        pinyin: 'xià xuě le wù liú kě néng huì màn yī diǎn',
        english: "It's snowing, so deliveries may be slower.",
        distractors: [
          {
            score: 0.81,
            simp: '下雨天配送会慢一点。',
            english: 'Deliveries are a bit slower on rainy days.',
          },
          {
            score: 0.65,
            simp: '提防路滑，慢点走。',
            english: 'Watch out, the road is slippery; walk slowly.',
          },
          {
            score: 0.65,
            simp: '下雨天阶梯很滑，慢点走。',
            english: 'The steps are slippery when it rains; walk slowly.',
          },
        ],
      },
      {
        id: '9f82d51fc9',
        simp: '我哥哥在一家物流公司上班。',
        pinyin: 'wǒ gē ge zài yī jiā wù liú gōng sī shàng bān',
        english: 'My brother works at a logistics company.',
        distractors: [
          {
            score: 0.8,
            simp: '那家公司由我的哥哥经营。',
            english: 'That company is managed by my older brother.',
          },
          {
            score: 0.72,
            simp: '他在一家电信公司上班。',
            english: 'He works at a telecom company.',
          },
          {
            score: 0.66,
            simp: '她在一家外资公司上班。',
            english: 'She works at a foreign-owned company.',
          },
        ],
      },
      {
        id: '42a0c5363a',
        simp: '这家公司的物流很快，第二天就到了。',
        pinyin: 'zhè jiā gōng sī de wù liú hěn kuài dì èr tiān jiù dào le',
        english: "This company's delivery is fast; it arrived the next day.",
        distractors: [
          {
            score: 0.69,
            simp: '这家公司扩张得太快了。',
            english: 'This company expanded too fast.',
          },
          { score: 0.74, simp: '这家公司发展势头很猛。', english: 'This company is growing fast.' },
          {
            score: 0.7,
            simp: '他在一家公司做配送员。',
            english: 'He works as a delivery driver for a company.',
          },
        ],
      },
    ],
  },
  {
    simp: '均匀',
    pinyin: 'jun1 yun2',
    meaning: 'even/well-distributed/homogeneous/well-proportioned (figure, body etc)',
    sentences: [
      {
        id: '33e0b4e17f',
        simp: '将混合物搅拌均匀。',
        pinyin: 'jiāng hùn hé wù jiǎo bàn jūn yún',
        english: 'Blend the mixture together until it is smooth.',
        distractors: [
          {
            score: 0.61,
            simp: '工人在路边搅拌水泥。',
            english: 'Workers are mixing cement by the road.',
          },
          {
            score: 0.61,
            simp: '如果将蓝色和红色混合，就会得到紫色。',
            english: "If you mix blue and red, you'll get purple.",
          },
          {
            score: 0.66,
            simp: '妈妈在厨房里拌馅儿。',
            english: 'Mom is mixing the filling in the kitchen.',
          },
        ],
      },
      {
        id: 'a8c43068db',
        simp: '把面粉和水搅拌均匀。',
        pinyin: 'bǎ miàn fěn hé shuǐ jiǎo bàn jūn yún',
        english: 'Mix the flour and water evenly.',
        distractors: [
          { score: 0.77, simp: '把面粉筛一下再用。', english: 'Sift the flour before using it.' },
          { score: 0.72, simp: '面包是面粉做的。', english: 'Bread is made from flour.' },
          {
            score: 0.71,
            simp: '面粉是那些你始终应该储备在厨房里的产品之一。',
            english: 'Flour is one of those products you should always have in your kitchen.',
          },
        ],
      },
      {
        id: '2e23fca48e',
        simp: '请把颜色涂得均匀一点。',
        pinyin: 'qǐng bǎ yán sè tú de jūn yún yī diǎn',
        english: 'Please spread the paint a bit more evenly.',
        distractors: [
          {
            score: 0.7,
            simp: '请把图片缩小一点。',
            english: 'Please make the picture a bit smaller.',
          },
          {
            score: 0.7,
            simp: '照片印出来以后，颜色有点错位。',
            english: 'When the photo was printed, the colors were slightly misaligned.',
          },
          {
            score: 0.66,
            simp: '可以请你小声一点吗？',
            english: 'Could you speak a little less loudly?',
          },
        ],
      },
    ],
  },
  {
    simp: '宣称',
    pinyin: 'xuan1 cheng1',
    meaning: 'to assert/to claim',
    sentences: [
      {
        id: 'a739a3cfae',
        simp: '他宣称自己是无辜的。',
        pinyin: 'tā xuān chēng zì jǐ shì wú gū de',
        english: 'He claimed he was innocent.',
        distractors: [
          {
            score: 0.73,
            simp: '他理直气壮地说自己没错。',
            english: "He said boldly that he wasn't wrong.",
          },
          { score: 0.73, simp: '他承认了自己的过失。', english: 'He admitted his mistake.' },
          {
            score: 0.71,
            simp: '他说错一句话，暴露了自己的身份。',
            english: 'He said one wrong thing and gave away who he was.',
          },
        ],
      },
      {
        id: '6a20f82a29',
        simp: '有人宣称看到了外星人。',
        pinyin: 'yǒu rén xuān chēng kàn dào le wài xīng rén',
        english: 'Someone claimed to have seen aliens.',
        distractors: [
          { score: 0.75, simp: '不是所有外星人都坏。', english: 'Not all aliens are bad.' },
          {
            score: 0.74,
            simp: '你觉着有外星人存在吗？',
            english: 'Do you think there are aliens?',
          },
          { score: 0.69, simp: '你还看到了什么？', english: 'What else did you see?' },
        ],
      },
      {
        id: '90b96ca53f',
        simp: '广告宣称这种水能治百病。',
        pinyin: 'guǎng gào xuān chēng zhè zhǒng shuǐ néng zhì bǎi bìng',
        english: 'The ad claims this water can cure every illness.',
        distractors: [
          {
            score: 0.62,
            simp: '这种病早期发现就能治好。',
            english: "This illness can be cured if it's found early.",
          },
          { score: 0.72, simp: '这种药能消灭细菌。', english: 'This medicine can kill bacteria.' },
          {
            score: 0.7,
            simp: '这种药要先在水里溶解再喝。',
            english: 'This medicine must be dissolved in water before you drink it.',
          },
        ],
      },
    ],
  },
];

const now = () => Date.now();

const shuffle = <T,>(items: T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

interface Task {
  word: ProtoWord;
  target: Sentence;
  /** The options in screen order: the target and the other sentences of the word. */
  options: Sentence[];
  /** Variant C: the one English shown. The target half of the time. */
  probe: Sentence;
}

const makeTasks = (words: ProtoWord[]): Task[] => {
  // A sentence with its own distractors: every sentence of every word, in a
  // random order, with the target and its 3 distractors as options.
  if (words.some((w) => w.sentences.some((s) => s.distractors))) {
    return shuffle(
      words.flatMap((word) =>
        word.sentences.map((target) => {
          const decoys: Sentence[] = (target.distractors ?? []).map((d, i) => ({
            id: `${target.id}-d${i} (${d.score} ${d.simp})`,
            simp: d.simp,
            pinyin: '',
            english: d.english,
          }));
          return {
            word,
            target,
            options: shuffle([target, ...decoys]),
            probe: Math.random() < 0.5 ? target : decoys[Math.floor(Math.random() * decoys.length)],
          };
        }),
      ),
    );
  }
  return words.map((word) => {
    const target = word.sentences[Math.floor(Math.random() * word.sentences.length)];
    const others = word.sentences.filter((s) => s !== target);
    return {
      word,
      target,
      options: shuffle(word.sentences),
      probe: Math.random() < 0.5 ? target : others[Math.floor(Math.random() * others.length)],
    };
  });
};

interface LogEntry {
  variant: Variant;
  word: string;
  sentenceId: string;
  mode: 'audio' | 'text';
  grade: 'right' | 'wrong';
  picked: string;
  textSeen: boolean;
  answerMs: number;
  optionsMs?: number;
}

const speakZh = (sentence: string) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(sentence);
  u.lang = 'zh-CN';
  window.speechSynthesis.speak(u);
};

const OptionButton: React.FC<{
  label: string;
  state: 'idle' | 'right' | 'wrong' | 'faded';
  disabled: boolean;
  onClick: () => void;
}> = ({ label, state, disabled, onClick }) => (
  <ButtonBase
    onClick={onClick}
    disabled={disabled}
    sx={{
      width: '100%',
      justifyContent: 'flex-start',
      textAlign: 'left',
      p: 1.75,
      borderRadius: 1,
      fontSize: 17,
      fontFamily: fonts.body,
      border: `1px solid ${
        state === 'right'
          ? colors.success
          : state === 'wrong'
            ? colors.primaryLight
            : colors.borderStrong
      }`,
      bgcolor:
        state === 'right'
          ? colors.successSurface
          : state === 'wrong'
            ? colors.errorSurface
            : colors.card,
      color: state === 'faded' ? colors.textSecondary : colors.text,
    }}
  >
    {label}
  </ButtonBase>
);

const TaskView: React.FC<{
  variant: Variant;
  task: Task;
  useSound: boolean;
  onLog: (entry: LogEntry) => void;
  onNext: () => void;
}> = ({ variant, task, useSound, onLog, onNext }) => {
  const [textShown, setTextShown] = useState(!useSound);
  const [optionsShown, setOptionsShown] = useState(variant !== 'B');
  const [picked, setPicked] = useState<Sentence | 'match' | 'nomatch' | null>(null);
  const textSeen = useRef(!useSound);
  const shownAt = useRef(0);
  const optionsAt = useRef(0);

  useEffect(() => {
    shownAt.current = now();
    if (useSound) speakZh(task.target.simp);
  }, [task, useSound]);

  const finished = picked !== null;
  const probeMatches = task.probe === task.target;

  const grade = (choice: Sentence | 'match' | 'nomatch') => {
    setPicked(choice);
    setTextShown(true);
    const right =
      choice === 'match'
        ? probeMatches
        : choice === 'nomatch'
          ? !probeMatches
          : choice === task.target;
    onLog({
      variant,
      word: task.word.simp,
      sentenceId: task.target.id,
      mode: useSound ? 'audio' : 'text',
      grade: right ? 'right' : 'wrong',
      picked: typeof choice === 'string' ? `${choice} (${task.probe.id})` : choice.id,
      textSeen: textSeen.current,
      answerMs: now() - shownAt.current,
      optionsMs: variant === 'B' ? optionsAt.current - shownAt.current : undefined,
    });
  };

  const optionState = (s: Sentence) => {
    if (!finished) return 'idle';
    if (s === task.target) return 'right';
    if (s === picked) return 'wrong';
    return 'faded';
  };

  return (
    <>
      <StudyBody>
        <StudyCard
          height={finished ? undefined : 220}
          sx={{ mt: 3, gap: 2, justifyContent: 'center' }}
        >
          {useSound && (
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <PlayButton
                size={textShown ? 44 : 88}
                loading={false}
                onClick={() => speakZh(task.target.simp)}
              />
            </Box>
          )}
          {textShown && (
            <Box
              component="p"
              lang="zh"
              sx={{ m: 0, fontFamily: fonts.hanzi, fontSize: 34, lineHeight: 1.6 }}
            >
              {task.target.simp}
            </Box>
          )}
          {finished && (
            <Box
              component="p"
              lang="zh-Latn"
              sx={{ m: 0, fontSize: 15, color: colors.textSecondary }}
            >
              {task.target.pinyin} · <b lang="zh">{task.word.simp}</b> {task.word.meaning}
            </Box>
          )}
          {useSound && !finished && (
            <PillToggle
              pressed={textShown}
              onClick={() => {
                textSeen.current = true;
                setTextShown((v) => !v);
              }}
            >
              {textShown ? text.hideText : text.showText}
            </PillToggle>
          )}
        </StudyCard>

        {variant !== 'C' && optionsShown && (
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ fontSize: 14, color: colors.textSecondary, textAlign: 'left' }}>
              {text.pickPrompt}
            </Box>
            {task.options.map((s) => (
              <OptionButton
                key={s.id}
                label={s.english}
                state={optionState(s)}
                disabled={finished}
                onClick={() => grade(s)}
              />
            ))}
          </Box>
        )}

        {variant === 'C' && (
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ fontSize: 14, color: colors.textSecondary, textAlign: 'left' }}>
              {text.matchPrompt}
            </Box>
            <OptionButton
              label={task.probe.english}
              state={finished ? (probeMatches ? 'right' : 'wrong') : 'idle'}
              disabled
              onClick={() => undefined}
            />
            {finished && !probeMatches && (
              <OptionButton
                label={task.target.english}
                state="right"
                disabled
                onClick={() => undefined}
              />
            )}
          </Box>
        )}

        {finished && (
          <Box
            sx={{
              mt: 2,
              fontWeight: 600,
              color: picked && isRight(task, picked) ? colors.success : colors.primaryLight,
            }}
          >
            {picked && isRight(task, picked) ? text.right : text.wrong}
          </Box>
        )}
      </StudyBody>

      {finished ? (
        <StudyButton variant="primary" onClick={onNext}>
          {text.next}
        </StudyButton>
      ) : variant === 'B' && !optionsShown ? (
        <StudyButton
          variant="primary"
          onClick={() => {
            optionsAt.current = now();
            setOptionsShown(true);
          }}
        >
          {text.showOptions}
        </StudyButton>
      ) : variant === 'C' ? (
        <Box sx={{ display: 'flex', gap: 1.25 }}>
          <StudyButton onClick={() => grade('nomatch')}>{text.noMatch}</StudyButton>
          <StudyButton variant="primary" onClick={() => grade('match')}>
            {text.matches}
          </StudyButton>
        </Box>
      ) : null}
    </>
  );
};

const isRight = (task: Task, choice: Sentence | 'match' | 'nomatch') =>
  choice === 'match'
    ? task.probe === task.target
    : choice === 'nomatch'
      ? task.probe !== task.target
      : choice === task.target;

const PrototypeSwitcher: React.FC<{ current: Variant; onChange: (v: Variant) => void }> = ({
  current,
  onChange,
}) => {
  const step = useCallback(
    (delta: number) => {
      const i = VARIANTS.indexOf(current);
      onChange(VARIANTS[(i + delta + VARIANTS.length) % VARIANTS.length]);
    },
    [current, onChange],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable))
        return;
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);
  if (!import.meta.env.DEV) return null;
  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1,
        py: 0.5,
        borderRadius: 999,
        bgcolor: '#111',
        color: '#fff',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        fontSize: 14,
      }}
    >
      <ButtonBase onClick={() => step(-1)} sx={{ px: 1, color: '#fff', fontSize: 18 }}>
        ‹
      </ButtonBase>
      <span>
        {current} ({text.variantNames[current]})
      </span>
      <ButtonBase onClick={() => step(1)} sx={{ px: 1, color: '#fff', fontSize: 18 }}>
        ›
      </ButtonBase>
    </Box>
  );
};

const ComprehendPickPrototype: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const raw = params.get('variant');
  const variant: Variant = VARIANTS.includes(raw as Variant) ? (raw as Variant) : 'A';

  // `?set=easy` gives the HSK 1-2 words, the default the HSK 7-9 words.
  const wordSet = params.get('set') === 'easy' ? WORDS : HARD_WORDS;
  const [useSound, setUseSound] = useState(true);
  const [tasks, setTasks] = useState<Task[]>(() => makeTasks(wordSet));
  const [index, setIndex] = useState(0);
  const [log, setLog] = useState<(LogEntry | TileLog)[]>([]);
  const [tileOrder, setTileOrder] = useState(() => shuffle(TILE_SENTENCES));

  const restart = () => {
    window.speechSynthesis?.cancel();
    setTasks(makeTasks(wordSet));
    setTileOrder(shuffle(TILE_SENTENCES));
    setIndex(0);
  };

  const setVariant = (v: Variant) => {
    const next = new URLSearchParams(location.search);
    next.set('variant', v);
    history.replace({ search: `?${next.toString()}` });
    restart();
  };

  const tile = isTile(variant);
  const total = tile ? tileOrder.length : tasks.length;
  const tileSentence = tile ? tileOrder[index] : undefined;
  const task = tile ? undefined : tasks[index];
  const key = useMemo(
    () => `${variant}-${useSound}-${index}-${task?.target.id}`,
    [variant, useSound, index, task],
  );

  return (
    <StudyScreen>
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          justifyContent: 'space-between',
          alignItems: 'center',
          mt: 1,
        }}
      >
        <Box sx={{ display: 'flex', gap: 1 }}>
          <PillToggle pressed={useSound} onClick={() => setUseSound(true)}>
            {text.audio}
          </PillToggle>
          <PillToggle pressed={!useSound} onClick={() => setUseSound(false)}>
            {text.text}
          </PillToggle>
        </Box>
        <Box sx={{ fontSize: 14, color: colors.textSecondary }}>
          {Math.min(index + 1, total)} / {total}
        </Box>
      </Box>

      {tileSentence && isTile(variant) ? (
        <TileTask
          key={`${variant}-${useSound}-${index}-${tileSentence.id}`}
          variant={variant}
          sentence={tileSentence}
          useSound={useSound}
          onLog={(entry) => setLog((prev) => [entry, ...prev])}
          onNext={() => setIndex((i) => i + 1)}
        />
      ) : task ? (
        <TaskView
          key={key}
          variant={variant}
          task={task}
          useSound={useSound}
          onLog={(entry) => setLog((prev) => [entry, ...prev])}
          onNext={() => setIndex((i) => i + 1)}
        />
      ) : (
        <>
          <StudyBody>
            <Box sx={{ mt: 6, fontSize: 20 }}>{text.done}</Box>
          </StudyBody>
          <StudyButton variant="primary" onClick={restart}>
            {text.restart}
          </StudyButton>
        </>
      )}

      <Box
        component="details"
        sx={{ mt: 2, mb: 10, textAlign: 'left', fontSize: 12, fontFamily: 'monospace' }}
      >
        <summary>
          {text.state} ({log.length})
        </summary>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(log, null, 2)}</pre>
      </Box>

      <PrototypeSwitcher current={variant} onChange={setVariant} />
    </StudyScreen>
  );
};

export default ComprehendPickPrototype;
