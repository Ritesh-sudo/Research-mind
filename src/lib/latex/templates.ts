export type LatexTemplate = 'neurips' | 'icml' | 'ieee' | 'acm' | 'arxiv'

const ABSTRACT_PLACEHOLDER = `% Write your abstract here.
This paper presents a novel approach to...`

const INTRO_PLACEHOLDER = `\\section{Introduction}
% Introduce your research problem, motivation, and contributions.
Deep learning has revolutionized...

\\textbf{Contributions:}
\\begin{itemize}
  \\item We propose...
  \\item We demonstrate...
  \\item We release...
\\end{itemize}`

const RELATED_PLACEHOLDER = `\\section{Related Work}
% Discuss related papers and how your work differs.`

const METHOD_PLACEHOLDER = `\\section{Methodology}
% Describe your approach in detail.

\\subsection{Problem Formulation}

\\subsection{Proposed Method}`

const EXPERIMENTS_PLACEHOLDER = `\\section{Experiments}
% Describe experimental setup, datasets, baselines.

\\subsection{Experimental Setup}

\\subsection{Datasets}

\\subsection{Baselines}`

const RESULTS_PLACEHOLDER = `\\section{Results}
% Present quantitative and qualitative results.`

const DISCUSSION_PLACEHOLDER = `\\section{Discussion}
% Analyze results, limitations, and future work.`

const CONCLUSION_PLACEHOLDER = `\\section{Conclusion}
% Summarize contributions and findings.`

const REFERENCES_PLACEHOLDER = `\\bibliographystyle{plain}
\\bibliography{references}`

export function getTemplate(name: LatexTemplate, title: string, topic: string): string {
  const templates: Record<LatexTemplate, string> = {
    neurips: `\\documentclass{article}
\\usepackage[preprint]{neurips_2024}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{hyperref}
\\usepackage{url}
\\usepackage{booktabs}
\\usepackage{amsfonts}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{nicefrac}
\\usepackage{microtype}
\\usepackage{graphicx}

\\title{${title}}

\\author{
  Author Name \\\\
  Institution \\\\
  \\texttt{author@institution.edu}
}

\\begin{document}

\\maketitle

\\begin{abstract}
${ABSTRACT_PLACEHOLDER}
\\end{abstract}

${INTRO_PLACEHOLDER}

${RELATED_PLACEHOLDER}

${METHOD_PLACEHOLDER}

${EXPERIMENTS_PLACEHOLDER}

${RESULTS_PLACEHOLDER}

${DISCUSSION_PLACEHOLDER}

${CONCLUSION_PLACEHOLDER}

${REFERENCES_PLACEHOLDER}

\\end{document}`,

    icml: `\\documentclass{article}
\\usepackage[accepted]{icml2024}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage{hyperref}

\\icmltitlerunning{${title}}

\\begin{document}

\\twocolumn[
\\icmltitle{${title}}

\\begin{icmlauthorlist}
\\icmlauthor{Author Name}{institution}
\\end{icmlauthorlist}
\\icmlaffiliation{institution}{Department, Institution, City, Country}
\\icmlcorrespondingauthor{Author Name}{author@institution.edu}

\\icmlkeywords{Machine Learning, ICML}

\\vskip 0.3in
]

\\begin{abstract}
${ABSTRACT_PLACEHOLDER}
\\end{abstract}

${INTRO_PLACEHOLDER}

${RELATED_PLACEHOLDER}

${METHOD_PLACEHOLDER}

${EXPERIMENTS_PLACEHOLDER}

${RESULTS_PLACEHOLDER}

${DISCUSSION_PLACEHOLDER}

${CONCLUSION_PLACEHOLDER}

${REFERENCES_PLACEHOLDER}

\\end{document}`,

    ieee: `\\documentclass[conference]{IEEEtran}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage{hyperref}
\\usepackage{cite}

\\begin{document}

\\title{${title}}

\\author{
  \\IEEEauthorblockN{Author Name}
  \\IEEEauthorblockA{
    Department \\\\
    Institution \\\\
    Email: author@institution.edu
  }
}

\\maketitle

\\begin{abstract}
${ABSTRACT_PLACEHOLDER}
\\end{abstract}

\\begin{IEEEkeywords}
machine learning, deep learning, ${topic}
\\end{IEEEkeywords}

${INTRO_PLACEHOLDER}

${RELATED_PLACEHOLDER}

${METHOD_PLACEHOLDER}

${EXPERIMENTS_PLACEHOLDER}

${RESULTS_PLACEHOLDER}

${DISCUSSION_PLACEHOLDER}

${CONCLUSION_PLACEHOLDER}

${REFERENCES_PLACEHOLDER}

\\end{document}`,

    acm: `\\documentclass[sigconf]{acmart}
\\usepackage{amsmath}
\\usepackage{graphicx}
\\usepackage{booktabs}

\\begin{document}

\\title{${title}}

\\author{Author Name}
\\email{author@institution.edu}
\\institution{Institution}

\\begin{abstract}
${ABSTRACT_PLACEHOLDER}
\\end{abstract}

\\keywords{machine learning, ${topic}}

\\maketitle

${INTRO_PLACEHOLDER}

${RELATED_PLACEHOLDER}

${METHOD_PLACEHOLDER}

${EXPERIMENTS_PLACEHOLDER}

${RESULTS_PLACEHOLDER}

${DISCUSSION_PLACEHOLDER}

${CONCLUSION_PLACEHOLDER}

\\bibliographystyle{ACM-Reference-Format}
\\bibliography{references}

\\end{document}`,

    arxiv: `\\documentclass{article}
\\usepackage[margin=1in]{geometry}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage{hyperref}
\\usepackage{natbib}

\\title{${title}}
\\author{Author Name \\\\ Institution \\\\ \\texttt{author@institution.edu}}
\\date{\\today}

\\begin{document}

\\maketitle

\\begin{abstract}
${ABSTRACT_PLACEHOLDER}
\\end{abstract}

${INTRO_PLACEHOLDER}

${RELATED_PLACEHOLDER}

${METHOD_PLACEHOLDER}

${EXPERIMENTS_PLACEHOLDER}

${RESULTS_PLACEHOLDER}

${DISCUSSION_PLACEHOLDER}

${CONCLUSION_PLACEHOLDER}

\\bibliographystyle{plainnat}
\\bibliography{references}

\\end{document}`,
  }

  return templates[name]
}
