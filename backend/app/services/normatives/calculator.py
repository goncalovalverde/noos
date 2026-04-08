import json
from pathlib import Path
from scipy import stats

TABLES_DIR = Path(__file__).parent / "tables"


class NormativeCalculator:
    TEST_FILES = {
        "TMT-A": "tmt_a.json",
        "TMT-B": "tmt_b.json",
        "Fluidez-FAS": "fluidez_fas.json",
        "Fluidez-Semantica": "fluidez_semantica.json",
        "TAVEC": "tavec.json",
        "Rey-Copia": "rey_copia.json",
        "Rey-Memoria": "rey_memoria.json",
    }

    PE_TO_PERCENTILE: dict[int, float] = {
        1: 0.1, 2: 0.5, 3: 2.0, 4: 4.5, 5: 8.0, 6: 12.0, 7: 17.0, 8: 25.0,
        9: 37.0, 10: 50.0, 11: 63.0, 12: 75.0, 13: 84.0, 14: 91.0, 15: 95.0,
        16: 97.0, 17: 98.5, 18: 99.5, 19: 99.9,
    }

    def __init__(self):
        self._tables: dict = {}
        self._load_tables()

    def _load_tables(self):
        for test_type, filename in self.TEST_FILES.items():
            path = TABLES_DIR / filename
            if path.exists():
                with open(path, encoding="utf-8") as f:
                    self._tables[test_type] = json.load(f)

    def calculate(self, test_type: str, raw_score: float, age: int, education_years: int) -> dict:
        if test_type in self._tables:
            return self._calculate_from_table(test_type, raw_score, age, education_years)
        return self._calculate_simulated(test_type, raw_score, age, education_years)

    def _calculate_from_table(self, test_type: str, raw_score: float, age: int, education_years: int) -> dict:
        table = self._tables[test_type]

        age_range = None
        for ar in table["age_ranges"]:
            if ar["age_min"] <= age <= ar["age_max"]:
                age_range = ar
                break
        if age_range is None:
            age_range = table["age_ranges"][0]

        edu_range = None
        for er in age_range["education_ranges"]:
            if er["education_min"] <= education_years <= er["education_max"]:
                edu_range = er
                break
        if edu_range is None:
            edu_range = age_range["education_ranges"][0]

        conv_table = edu_range["conversion_table"]

        key = str(int(raw_score))
        if key in conv_table:
            pe = conv_table[key]["pe"]
            percentil = conv_table[key]["percentil"]
        else:
            pe, percentil = self._interpolate_scores(raw_score, conv_table)

        percentil_clamped = max(0.01, min(99.99, percentil))
        z_score = round(stats.norm.ppf(percentil_clamped / 100), 2)

        return {
            "puntuacion_escalar": int(pe),
            "percentil": float(percentil),
            "z_score": z_score,
            "clasificacion": self._classify(percentil),
            "norma_aplicada": {
                "fuente": "NEURONORMA",
                "test": test_type,
                "rango_edad": f"{age_range['age_min']}-{age_range['age_max']}",
                "rango_educacion": f"{edu_range['education_min']}-{edu_range['education_max']}",
            },
        }

    def _interpolate_scores(self, raw_score: float, conversion_table: dict):
        available = sorted(int(k) for k in conversion_table.keys())
        lower_scores = [s for s in available if s <= raw_score]
        upper_scores = [s for s in available if s >= raw_score]

        if not lower_scores:
            k = str(available[0])
            return conversion_table[k]["pe"], conversion_table[k]["percentil"]
        if not upper_scores:
            k = str(available[-1])
            return conversion_table[k]["pe"], conversion_table[k]["percentil"]

        lower = lower_scores[-1]
        upper = upper_scores[0]

        if lower == upper:
            k = str(lower)
            return conversion_table[k]["pe"], conversion_table[k]["percentil"]

        ratio = (raw_score - lower) / (upper - lower)
        pe_l = conversion_table[str(lower)]["pe"]
        pe_u = conversion_table[str(upper)]["pe"]
        p_l = conversion_table[str(lower)]["percentil"]
        p_u = conversion_table[str(upper)]["percentil"]

        pe = round(pe_l + ratio * (pe_u - pe_l))
        percentil = round(p_l + ratio * (p_u - p_l), 1)
        return pe, percentil

    def calculate_from_pe(self, test_type: str, pe: int) -> dict:
        """Use when the clinician provides the PE directly (e.g. WAIS-IV subtests)."""
        pe = max(1, min(19, int(pe)))
        percentil = self.PE_TO_PERCENTILE.get(pe, 50.0)
        z_score = round(stats.norm.ppf(max(0.001, min(0.999, percentil / 100))), 2)
        return {
            "puntuacion_escalar": pe,
            "percentil": percentil,
            "z_score": z_score,
            "clasificacion": self._classify(percentil),
            "norma_aplicada": {"fuente": "WAIS-IV", "test": test_type},
        }

    def _calculate_simulated(self, test_type: str, raw_score: float, age: int, education_years: int) -> dict:
        """No validated normative table available for this test."""
        return {
            "puntuacion_escalar": None,
            "percentil": None,
            "z_score": None,
            "clasificacion": "Sin norma validada",
            "norma_aplicada": {"fuente": "Sin tabla normativa", "test": test_type},
        }

    def _classify(self, percentil: float) -> str:
        if percentil >= 75:
            return "Superior"
        if percentil >= 25:
            return "Normal"
        if percentil >= 10:
            return "Limítrofe"
        return "Deficitario"


calculator = NormativeCalculator()
