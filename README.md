# Jogo de Ecolocalização

**Disciplina:** EEL882 - Computação Gráfica  
**Aluno:** Raphael Henrique da Silva Pereira  
**DRE:** 123420783  

---

## 🦇 Sobre o Projeto
Este é um jogo 2D desenvolvido em JavaScript utilizando a biblioteca **p5.js**. O objetivo principal é guiar um personagem através de um labirinto na escuridão total, utilizando apenas a mecânica de ecolocalização (sonar) para revelar o cenário ao redor. 

Decidi focar nos conceitos apresentados nas aulas de computação gráfica que mais me interessei:
*   **Ray Marching:** Utilizado para calcular a emissão dos raios de som do sonar, detectando obstáculos e paredes.
*   **Signed Distance Fields (SDF):** Usado para detectar as distâncias da geometria da cena e garantir as colisões.
*   **Curvas de Bézier e Splines:** O jogo suporta paredes arredondadas e orgânicas, criadas a partir do algoritmo de Bézier.

## 🎮 Como Jogar
O jogador deve encontrar a saída (círculo verde) utilizando o sonar para mapear o labirinto.
No menu, é possível escolher entre dois personagens com características únicas:
*   **Morcego:** Possui um sonar de longo alcance, porém focado apenas em formato de cone direcional para frente.
*   **Golfinho:** Possui um sonar de curto alcance, porém revelando uma área 360° em torno de si.

### Controles Principais
*   **Setas do Teclado:** Move o personagem.
*   **Tecla M:** Ativa o pulso de Sonar (revela o mapa ao redor baseado no alcance do personagem). O uso tem um *cooldown*.
*   **Tecla V:** Alterna o modo de visualização Debug (mostra o labirinto completo e as formas geométricas que o compõe).
*   **Tecla P:** Alterna o desenho dos passos (steps) do algoritmo de Ray Marching.

## 🛠️ Editor de Fases (Sandbox)
O jogo possui um poderoso editor de níveis embutido. Ao pressionar **S** no Menu Principal, o jogador é levado para o Sandbox.
Neste modo, é possível construir labirintos customizados utilizando um sistema de grade simples (clicando e arrastando nas bordas), definir pontos de início e saída e desenhar geometria complexa com **Curvas Bézier** e **Splines**. 

Dentro do modo Sandbox:
*   Use as ferramentas à direita para desenhar paredes, curvas ou apagar.
*   Pressione **Z** para Desfazer a última alteração.
*   Pressione **ENTER** ou clique em **JOGAR** para testar sua criação na mesma hora.
*   É possível **Exportar** a fase criada diretamente como código Javascript.

## 🚀 Como Executar
O jogo é nativo para Web. Para rodá-lo:
1. Faça o download da pasta do projeto.
2. Abra o arquivo `index.html` no navegador web (lembrar de ter a biblioteca p5.js).

Extra: O jogo esta hospedado no github via github-pages já compilado para ser jogado.
