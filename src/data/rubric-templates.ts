export type RubricItem = {
  text: string;
  description: string;
};

export type RubricTemplate = {
  id: string;
  name: string;
  items: RubricItem[];
};

export const RUBRIC_TEMPLATES: RubricTemplate[] = [
  {
    id: "frontend-codepen",
    name: "Frontend — CodePen",
    items: [
      {
        text: "CodePen forked and saved",
        description: "CodePen was forked and saved to the student's account.",
      },
      {
        text: "All instructions were followed",
        description: "Provided instructions were followed correctly to get the correct result.",
      },
      {
        text: "Code is formatted",
        description: "Code is formatted for legibility",
      },
      {
        text: "CodePen works correctly with no errors",
        description: "No errors in the console!",
      },
    ],
  },
  {
    id: "clean-comment-code",
    name: "Clean & Comment Your Code",
    items: [
      {
        text: "The code includes meaningful comments",
        description: "Code has comments that explain the purpose of functions and complex logic.",
      },
      {
        text: "Unnecessary console.logs are removed",
        description: "Logs for problems that have already been solved are removed from the code.",
      },
      {
        text: "Commented-out code is either deleted or moved to the bottom of the file",
        description: "Dead code is not left in the middle of active code.",
      },
    ],
  },
];
