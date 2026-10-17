# Blind holdout — keyword rules only (recorded 2026-10-17 14:30 ICT, before any change)

Holdout author never saw the rules (data/holdout/README.md). Reference matcher semantics from docs/clinical/check-redflags.mjs.

```
== rules v1.0 (frozen)
HO-01 th gold: chest | fired: RF-CHEST-01,RF-CHEST-02 
HO-02 th gold: stroke | fired: RF-STROKE-01 
HO-03 th gold: anaphylaxis | fired: RF-ANAPH-01 
HO-04 th gold: suicide | fired: -   <-- MISMATCH
HO-05 it gold: bleeding | fired: RF-BLEED-01 
HO-06 it gold: pregnancy | fired: RF-PREG-01 
HO-07 it gold: headache | fired: RF-HEAD-01 
HO-08 en gold: meningitis | fired: -   <-- MISMATCH
HO-09 en gold: seizure | fired: -   <-- MISMATCH
HO-10 en gold: syncope | fired: RF-SYNC-01 
HO-11 th gold: none | fired: RF-CHEST-01,RF-CHEST-02   <-- MISMATCH
HO-12 th gold: none | fired: RF-MENING-01   <-- MISMATCH
HO-13 it gold: none | fired: - 
HO-14 it gold: none | fired: - 
HO-15 it gold: none | fired: - 
HO-16 en gold: none | fired: - 
HO-17 en gold: none | fired: RF-SEIZ-01   <-- MISMATCH
HO-18 en gold: none | fired: - 
recall 7/10  false-alarm 3/8

== rules v1.1
HO-01 th gold: chest | fired: RF-CHEST-01,RF-CHEST-02 
HO-02 th gold: stroke | fired: RF-STROKE-01,RF-STROKE-02,RF-STROKE-03 
HO-03 th gold: anaphylaxis | fired: RF-ANAPH-01 
HO-04 th gold: suicide | fired: -   <-- MISMATCH
HO-05 it gold: bleeding | fired: RF-BLEED-01 
HO-06 it gold: pregnancy | fired: RF-PREG-01 
HO-07 it gold: headache | fired: RF-HEAD-01 
HO-08 en gold: meningitis | fired: -   <-- MISMATCH
HO-09 en gold: seizure | fired: -   <-- MISMATCH
HO-10 en gold: syncope | fired: RF-SYNC-01 
HO-11 th gold: none | fired: RF-CHEST-01,RF-CHEST-02   <-- MISMATCH
HO-12 th gold: none | fired: RF-MENING-01   <-- MISMATCH
HO-13 it gold: none | fired: - 
HO-14 it gold: none | fired: - 
HO-15 it gold: none | fired: - 
HO-16 en gold: none | fired: - 
HO-17 en gold: none | fired: RF-SEIZ-01   <-- MISMATCH
HO-18 en gold: none | fired: - 
recall 7/10  false-alarm 3/8
```

Rules must NOT be tuned on data/holdout. Misses motivate an add-only model red-flag screen (see docs/ai/DESIGN.md).
