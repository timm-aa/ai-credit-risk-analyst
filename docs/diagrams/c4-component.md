# C4 — Component (ядро системы)

Фокус: **оркестратор**, **retrieval** и **LLM-слой** — основа агентского трека.

```mermaid
flowchart TB
    subgraph Orchestrator["Orchestrator (state graph)"]
        PARSE[Intent & slots\nправила + опц. LLM]
        AGG[Fact aggregator\nнормализация ответов tools]
        RULES[Policy rules engine\ndетерминированно]
        ASM[Risk report assembler\nJSON + merge]
        GR[Guardrails\npre / post LLM]
    end

    subgraph Retrieval["Retriever"]
        QGEN[Query builder\nиз state]
        VEC[Vector search]
        KW[Fallback BM25]
        RR[Reranker\nопц.]
    end

    subgraph Tools["Tool layer"]
        TH[Credit History adapter]
        TPD[PD adapter]
    end

    subgraph LLM["LLM layer"]
        PROMPT[Prompt builder\nfacts + citations budget]
        GEN[Generation + structured parse]
        FB[LLM fallback\ntemplate if fail]
    end

    PARSE --> TH
    PARSE --> TPD
    TH --> AGG
    TPD --> AGG
    AGG --> RULES
    QGEN --> VEC
    VEC --> RR
    VEC -.->|empty| KW
    RR --> RULES
    KW --> RULES
    RULES --> PROMPT
    GR --> PROMPT
    PROMPT --> GEN
    GEN --> FB
    FB --> ASM
    GEN --> ASM
    RULES --> ASM
```

**Поток ответственности:** Tools дают факты → Rules + Retriever дают соответствие политике → LLM **только** формулирует объяснение при прохождении guardrails → Assembler не позволяет decision расходиться с правилами.
