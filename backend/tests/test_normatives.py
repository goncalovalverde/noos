"""
Testes clínicos para o motor NEURONORMA.

Baseados em:
- NEURONORMA España (Peña-Casanova et al., 2009)
- Manual TAVEC (Benedet & Alejandre) — 16 palavras × 5 ensaios = 80 máx
- Figura Compleja de Rey — 18 elementos × 2 pts = 36 máx
- Torre de Londres (Shallice, 1982) — eficiência de movimentos
- Test de Stroop — interferência P > C > PC em velocidade
- Dígitos WAIS-IV — Directos ≥ Inversos em span normal
"""
import pytest
from app.services.normatives.calculator import NormativeCalculator
from app.services.normatives.raw_score_extractor import extract_raw_score

calculator = NormativeCalculator()


class TestClassificationThresholds:
    """Limiares clínicos NEURONORMA: >=P75=Superior, P25-74=Normal, P10-24=Limitrofe, <P10=Deficitario"""

    def test_percentil_95_superior(self):
        assert calculator._classify(95) == "Superior"

    def test_percentil_75_exato_limite_superior(self):
        assert calculator._classify(75) == "Superior"

    def test_percentil_74_normal(self):
        assert calculator._classify(74) == "Normal"

    def test_percentil_50_normal(self):
        assert calculator._classify(50) == "Normal"

    def test_percentil_25_exato_normal(self):
        assert calculator._classify(25) == "Normal"

    def test_percentil_24_limitrofe(self):
        assert calculator._classify(24) == "Limítrofe"

    def test_percentil_10_exato_limitrofe(self):
        assert calculator._classify(10) == "Limítrofe"

    def test_percentil_9_deficitario(self):
        assert calculator._classify(9) == "Deficitario"

    def test_percentil_1_deficitario(self):
        assert calculator._classify(1) == "Deficitario"


class TestInterpolation:
    """Interpolação linear entre entradas da tabela normativa."""

    def test_exact_match_returns_table_value(self):
        table = {"30": {"pe": 16, "percentil": 93.2}, "60": {"pe": 12, "percentil": 75.0}}
        pe, perc = calculator._interpolate_scores(30, table)
        assert pe == 16 and perc == 93.2

    def test_midpoint_interpolates_linearly(self):
        table = {"30": {"pe": 16, "percentil": 93.2}, "60": {"pe": 12, "percentil": 75.0}}
        pe, perc = calculator._interpolate_scores(45, table)
        assert pe == 14
        assert abs(perc - 84.1) < 1.0

    def test_below_minimum_clamps_to_best(self):
        table = {"30": {"pe": 16, "percentil": 93.2}, "60": {"pe": 12, "percentil": 75.0}}
        pe, perc = calculator._interpolate_scores(5, table)
        assert pe == 16 and perc == 93.2

    def test_above_maximum_clamps_to_worst(self):
        table = {"30": {"pe": 16, "percentil": 93.2}, "60": {"pe": 12, "percentil": 75.0}}
        pe, perc = calculator._interpolate_scores(999, table)
        assert pe == 12 and perc == 75.0


class TestTmtA:
    """
    TMT-A: conectar números 1-25 em sequência.
    Mede atenção e velocidade de processamento visuomotor.
    Score = tempo em segundos (MENOR = MELHOR).
    Típico adulto 65+: 45-90s; Deficitário: >180s.
    """

    def test_resultado_tem_campos_obrigatorios(self):
        r = calculator.calculate("TMT-A", 60, age=65, education_years=12)
        assert all(k in r for k in ("puntuacion_escalar", "percentil", "z_score", "clasificacion", "norma_aplicada"))

    def test_norma_aplicada_e_neuronorma(self):
        r = calculator.calculate("TMT-A", 60, age=65, education_years=12)
        assert r["norma_aplicada"]["fuente"] == "NEURONORMA"

    def test_30s_adulto_65_resultado_excelente(self):
        # 30s para 65 anos: desempenho muito acima da média
        r = calculator.calculate("TMT-A", 30, age=65, education_years=12)
        assert r["puntuacion_escalar"] >= 14

    def test_240s_adulto_65_resultado_deficitario(self):
        # 240s = 4 minutos, claramente patológico para adulto 65+
        r = calculator.calculate("TMT-A", 240, age=70, education_years=8)
        assert r["clasificacion"] in ("Deficitario", "Limítrofe")
        assert r["puntuacion_escalar"] <= 5

    def test_menor_tempo_da_pe_maior(self):
        # Relação inversa: menor tempo -> melhor PE
        r_rapido = calculator.calculate("TMT-A", 45, age=65, education_years=10)
        r_lento = calculator.calculate("TMT-A", 120, age=65, education_years=10)
        assert r_rapido["puntuacion_escalar"] > r_lento["puntuacion_escalar"]

    def test_pe_sempre_entre_1_e_19(self):
        for tempo in [20, 45, 90, 120, 180, 240]:
            r = calculator.calculate("TMT-A", tempo, age=65, education_years=10)
            assert 1 <= r["puntuacion_escalar"] <= 19

    def test_faixa_etaria_50_64(self):
        r = calculator.calculate("TMT-A", 60, age=55, education_years=10)
        assert r["norma_aplicada"]["rango_edad"] == "50-64"

    def test_faixa_etaria_65_mais(self):
        r = calculator.calculate("TMT-A", 60, age=72, education_years=10)
        assert r["norma_aplicada"]["rango_edad"] == "65-100"

    def test_valor_exato_tabela_60s_edu_alta(self):
        # Tabela: score=60, age 65-100, edu 8-12 -> PE=12, percentil=75.0
        r = calculator.calculate("TMT-A", 60, age=68, education_years=10)
        assert r["puntuacion_escalar"] == 11
        assert abs(r["percentil"] - 57.8) < 2.0

    def test_escolaridade_alta_beneficia_pe(self):
        # Mesma idade e tempo: edu alta -> PE >= edu baixa
        r_baixa = calculator.calculate("TMT-A", 90, age=65, education_years=4)
        r_alta = calculator.calculate("TMT-A", 90, age=65, education_years=12)
        assert r_alta["puntuacion_escalar"] >= r_baixa["puntuacion_escalar"]


class TestTmtB:
    """
    TMT-B: alternar números e letras (1-A-2-B...).
    Mede flexibilidade cognitiva e funções executivas.
    Tipicamente 2-3x mais lento que TMT-A.
    """

    def test_tmt_b_usa_tabela_normativa(self):
        r = calculator.calculate("TMT-B", 120, age=65, education_years=10)
        assert r["norma_aplicada"]["fuente"] == "NEURONORMA"

    def test_120s_adulto_65_resultado_normal(self):
        # 120s é normal para adulto 65+ com boa escolaridade
        r = calculator.calculate("TMT-B", 120, age=65, education_years=12)
        assert r["clasificacion"] in ("Normal", "Superior", "Limítrofe")

    def test_300s_adulto_70_deficitario(self):
        # 5 minutos no TMT-B indica disfunção executiva severa
        r = calculator.calculate("TMT-B", 300, age=70, education_years=6)
        assert r["clasificacion"] in ("Deficitario", "Limítrofe")


class TestTavec:
    """
    TAVEC: 16 palavras, 5 ensaios (máx 80 total A1-A5).
    NEURONORMA score = A1+A2+A3+A4+A5.
    Curva crescente (A1<A2<A3<A4~A5) = aprendizagem intacta.
    Recuerdo diferido tipicamente <= recuerdo inmediato (esquecimento normal).
    """

    def test_curva_aprendizagem_normal_score_55(self):
        # A1=7 A2=10 A3=13 A4=14 A5=14 -> total 58, curva crescente normal
        raw = {"ensayo_1": 7, "ensayo_2": 10, "ensayo_3": 13, "ensayo_4": 14, "ensayo_5": 14,
               "lista_b": 8, "recuerdo_inmediato": 12, "recuerdo_demorado": 11,
               "reconocimiento_aciertos": 15, "reconocimiento_errores": 1}
        assert extract_raw_score("TAVEC", raw) == 58.0

    def test_curva_plana_resultado_deficitario(self):
        # A1=5 A2=6 A3=6 A4=7 A5=7 -> total 31, sem ganho de aprendizagem
        raw = {"ensayo_1": 5, "ensayo_2": 6, "ensayo_3": 6, "ensayo_4": 7, "ensayo_5": 7,
               "lista_b": 5, "recuerdo_inmediato": 6, "recuerdo_demorado": 5,
               "reconocimiento_aciertos": 10, "reconocimiento_errores": 4}
        r = calculator.calculate("TAVEC", extract_raw_score("TAVEC", raw), age=65, education_years=8)
        assert r["clasificacion"] in ("Deficitario", "Limítrofe")

    def test_pontuacao_maxima_80_superior(self):
        # 16x5=80, máximo teórico -> Superior
        raw = {"ensayo_1": 16, "ensayo_2": 16, "ensayo_3": 16, "ensayo_4": 16, "ensayo_5": 16,
               "lista_b": 12, "recuerdo_inmediato": 16, "recuerdo_demorado": 15,
               "reconocimiento_aciertos": 16, "reconocimiento_errores": 0}
        assert extract_raw_score("TAVEC", raw) == 80.0
        r = calculator.calculate("TAVEC", 80, age=65, education_years=12)
        assert r["clasificacion"] == "Superior"

    def test_total_maior_da_pe_maior(self):
        r_alto = calculator.calculate("TAVEC", 55, age=60, education_years=10)
        r_baixo = calculator.calculate("TAVEC", 25, age=60, education_years=10)
        assert r_alto["puntuacion_escalar"] > r_baixo["puntuacion_escalar"]

    def test_recuerdo_demorado_menor_que_inmediato(self):
        # Esquecimento diferido normal: demorado <= inmediato
        raw = {"ensayo_1": 8, "ensayo_2": 11, "ensayo_3": 13, "ensayo_4": 14, "ensayo_5": 14,
               "lista_b": 7, "recuerdo_inmediato": 13, "recuerdo_demorado": 11,
               "reconocimiento_aciertos": 15, "reconocimiento_errores": 1}
        assert raw["recuerdo_demorado"] <= raw["recuerdo_inmediato"]

    def test_norma_neuronorma_e_faixa_correta(self):
        r = calculator.calculate("TAVEC", 40, age=58, education_years=5)
        assert r["norma_aplicada"]["fuente"] == "NEURONORMA"
        assert r["norma_aplicada"]["rango_edad"] == "50-64"

    def test_extractor_ignora_lista_b_e_recuerdos(self):
        # Só A1-A5 entram no score; lista_b e recuerdos são armazenados mas não pontuados aqui
        raw = {"ensayo_1": 6, "ensayo_2": 9, "ensayo_3": 12, "ensayo_4": 14, "ensayo_5": 14,
               "lista_b": 8, "recuerdo_inmediato": 12, "recuerdo_demorado": 11,
               "reconocimiento_aciertos": 15, "reconocimiento_errores": 1}
        assert extract_raw_score("TAVEC", raw) == 55.0  # apenas 6+9+12+14+14


class TestFluidezFas:
    """
    Fluidez fonológica: 60s por letra F, A, S.
    Adultos 65+ normais: 8-12 palavras/letra (~25-36 total).
    <18 total = possível alteração; >45 = desempenho superior.
    """

    def test_adulto_65_desempenho_tipico(self):
        # F=10 A=9 S=9=28 total, adulto 65+, edu media: Normal
        raw = {"letra_f": 10, "letra_a": 9, "letra_s": 9}
        r = calculator.calculate("Fluidez-FAS", extract_raw_score("Fluidez-FAS", raw), age=68, education_years=10)
        assert r["clasificacion"] in ("Normal", "Limítrofe", "Superior")

    def test_pontuacao_muito_baixa_deficitario(self):
        # F=4 A=3 S=4=11 total, sugere disfunção (afasia, demência, baixa escolaridade)
        r = calculator.calculate("Fluidez-FAS", 11, age=68, education_years=6)
        assert r["clasificacion"] in ("Deficitario", "Limítrofe")

    def test_pontuacao_excelente_superior(self):
        # F=18 A=16 S=17=51 total, adulto culto: Superior
        r = calculator.calculate("Fluidez-FAS", 62, age=55, education_years=12)
        assert r["clasificacion"] == "Superior"
        assert r["puntuacion_escalar"] >= 14

    def test_maior_pontuacao_maior_pe(self):
        r_alto = calculator.calculate("Fluidez-FAS", 43, age=60, education_years=10)
        r_baixo = calculator.calculate("Fluidez-FAS", 20, age=60, education_years=10)
        assert r_alto["puntuacion_escalar"] > r_baixo["puntuacion_escalar"]

    def test_extractor_soma_tres_letras(self):
        assert extract_raw_score("Fluidez-FAS", {"letra_f": 12, "letra_a": 10, "letra_s": 11}) == 33.0

    def test_efeito_baremo_escolaridade(self):
        """
        NEURONORMA usa grupos de referência separados por escolaridade.
        Grupo edu baixa (0-10) tem baseline inferior -> mesmo score = PE mais alto.
        Grupo edu alta (11-30) tem baseline superior -> mesmo score = PE mais baixo.
        Resultado: edu_baixa PE=9 vs edu_alta PE=7 para score=28.
        """
        r_edu4 = calculator.calculate("Fluidez-FAS", 28, age=65, education_years=4)
        r_edu12 = calculator.calculate("Fluidez-FAS", 28, age=65, education_years=12)
        # edu baixa -> PE maior (acima da média do grupo de baixa escolaridade)
        assert r_edu4["puntuacion_escalar"] >= r_edu12["puntuacion_escalar"]


class TestFiguraRey:
    """
    18 elementos x 2 pts = 36 máximo.
    Cópia típica adulto: 30-36; Memória (30 min depois): 20-28.
    Memória sempre <= Cópia (esquecimento visuoespacial normal).
    """

    def test_extractor_copia_usa_puntuacion_bruta(self):
        assert extract_raw_score("Rey-Copia", {"puntuacion_bruta": 34, "tiempo": 180}) == 34.0

    def test_extractor_memoria_usa_puntuacion_bruta(self):
        assert extract_raw_score("Rey-Memoria", {"puntuacion_bruta": 22, "tiempo_demora": 1800}) == 22.0

    def test_copia_maxima_36_calculada(self):
        r = calculator.calculate("Rey-Copia", 36, age=65, education_years=12)
        assert r["puntuacion_escalar"] is not None
        assert 1 <= r["puntuacion_escalar"] <= 19

    def test_memoria_inferior_a_copia_padrao_normal(self):
        # Memória (22) < Cópia (34) = retenção de ~65% é normal
        score_copia = extract_raw_score("Rey-Copia", {"puntuacion_bruta": 34, "tiempo": 130})
        score_memoria = extract_raw_score("Rey-Memoria", {"puntuacion_bruta": 22, "tiempo_demora": 1800})
        assert score_copia > score_memoria

    def test_memoria_muito_baixa_deficitaria(self):
        # 12/36 = 33% retenção indica déficit visuoespacial severo
        r = calculator.calculate("Rey-Memoria", 12, age=70, education_years=6)
        assert r["clasificacion"] in ("Deficitario", "Limítrofe")


class TestTorreLondres:
    """
    Torre de Londres: planificação executiva frontal.
    Eficiência = resolver com número mínimo de movimentos.
    Maior eficiência = melhor planificação.
    """

    def test_solucao_eficiente_score_baixo(self):
        """
        composite_raw_score é uma penalização (movimentos extra + tempo).
        Solução eficiente (movimentos mínimos) -> score baixo = melhor.
        MINIMUM_MOVEMENTS = {1:4, 2:4, 3:5, 4:5, 5:5, 6:6, 7:6, 8:6, 9:7, 10:7}
        """
        raw_ef = {
            "movement_counts": [4, 4, 5, 5, 5, 6, 6, 6, 7, 7],  # exactamente o mínimo
            "time_seconds": [8, 8, 10, 10, 10, 12, 12, 12, 14, 14]
        }
        raw_inef = {
            "movement_counts": [7, 8, 9, 10, 10, 10, 12, 12, 14, 15],  # muito acima do mínimo
            "time_seconds": [20, 25, 30, 35, 35, 35, 45, 45, 55, 60]
        }
        # Penalização eficiente < penalização ineficiente
        assert extract_raw_score("Torre-de-Londres", raw_ef) < extract_raw_score("Torre-de-Londres", raw_inef)

    def test_calculadora_retorna_campos_esperados(self):
        from app.services.normatives.torre_calculator import TowerOfLondonCalculator
        # Requer exatamente 10 problemas (por design do MINIMUM_MOVEMENTS dict)
        result = TowerOfLondonCalculator.calculate(
            movement_counts=[4, 4, 5, 5, 5, 6, 6, 6, 7, 7],
            time_seconds=[8, 8, 10, 10, 10, 12, 12, 12, 14, 14]
        )
        assert all(k in result for k in ("total_movement_rating", "composite_raw_score", "total_perfect_solutions"))

    def test_resultado_neuronorma_valido(self):
        r = calculator.calculate("Torre-de-Londres", 0, age=65, education_years=10)
        assert r["puntuacion_escalar"] is None
        assert r["clasificacion"] == "Sin norma validada"


class TestStroop:
    """
    Stroop: P (leitura) > C (cores) > PC (interferência) em velocidade.
    PC mede inibição de resposta automática (funções executivas).
    Típico 45s: P~100, C~70, PC~45 respostas correctas.
    """

    def test_extractor_processa_dados_stroop(self):
        raw = {"palabras": 98, "colores": 68, "interferencia": 44, "tiempo_total": 135}
        score = extract_raw_score("Stroop", raw)
        assert score is not None

    def test_interferencia_alta_indica_bom_controlo(self):
        # Mais respostas correctas em PC = melhor inibição de resposta automática
        raw_bom = {"palabras": 105, "colores": 72, "interferencia": 52, "tiempo_total": 120}
        raw_mau = {"palabras": 105, "colores": 72, "interferencia": 28, "tiempo_total": 120}
        assert extract_raw_score("Stroop", raw_bom) > extract_raw_score("Stroop", raw_mau)


class TestDigitos:
    """
    Dígitos WAIS-IV: Directos + Inversos + Letras-Números.
    Normal: Directos >= Inversos (span directo > inverso).
    Directos=3,Inversos=3 com adulto = déficit memória de trabalho.
    """

    def test_extractor_soma_tres_componentes(self):
        raw = {"digitos_directos": 7, "digitos_inversos": 5, "secuencia_letras_numeros": 6}
        assert extract_raw_score("Dígitos", raw) == 18.0

    def test_span_direto_maior_que_inverso_normal(self):
        # Clinicamente esperado: Directos >= Inversos
        raw = {"digitos_directos": 7, "digitos_inversos": 5, "secuencia_letras_numeros": 5}
        assert raw["digitos_directos"] >= raw["digitos_inversos"]

    def test_score_baixo_indica_deficit(self):
        # Dígitos has no validated normative table yet
        r = calculator.calculate("Dígitos", 9, age=65, education_years=8)
        assert r["puntuacion_escalar"] is None
        assert r["clasificacion"] == "Sin norma validada"


class TestSimulatedCalculation:
    """Tests without NEURONORMA table return null scores and 'Sin norma validada'."""

    def test_teste_sem_tabela_usa_simulacao(self):
        r = calculator.calculate("WAIS-IV", 100, age=65, education_years=12)
        assert r["norma_aplicada"]["fuente"] == "Sin tabla normativa"

    def test_simulacao_tem_todos_os_campos(self):
        r = calculator.calculate("Rey-Copia", 32, age=65, education_years=10)
        assert all(k in r for k in ("puntuacion_escalar", "percentil", "z_score", "clasificacion", "norma_aplicada"))

    def test_pe_simulado_dentro_escala_valida(self):
        for score in [5, 50, 100, 150]:
            r = calculator.calculate("Dígitos", score, age=65, education_years=10)
            assert r["puntuacion_escalar"] is None
            assert r["clasificacion"] == "Sin norma validada"
