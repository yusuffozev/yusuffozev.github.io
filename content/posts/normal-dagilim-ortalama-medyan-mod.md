---
title: "Normal Dağılımda Ortalama, Medyan ve Mod Nasıl Değişir?"
description: "Çarpıklık arttıkça ortalama, medyan ve mod birbirinden nasıl ayrılır? Etkileşimli grafikle simetrik, sağa ve sola çarpık dağılımı karşılaştırın."
date: "2026-10-15"
createdAt: "2026-10-15T10:30:00.000Z"
readTime: "8 dk"
category: "Python"
categorySlug: "python"
subcategory: "Python ile İstatistik"
subcategorySlug: "python-ile-istatistik"
image: "/images/covers/post-normal-dagilim-ortalama-medyan-mod.svg"
---

## Kısa Cevap

Simetrik (normal) dağılımda **ortalama ≈ medyan ≈ mod** aynı yerdedir. Dağılım çarpıklaştıkça bu üç ölçü ayrılır:

- **Sağa çarpık:** mod < medyan < ortalama  
- **Sola çarpık:** ortalama < medyan < mod  

Aşağıdaki grafikte kaydırıcıyı hareket ettirerek bunu canlı görebilirsin.

## Etkileşimli grafik

Kaydırıcıyı sola çekersen dağılım **sola çarpık**, sağa çekersen **sağa çarpık** olur. Ortada ise klasik çan eğrisine yakın, simetrik bir görüntü oluşur.

<div class="interactive-chart" id="skewDemo">
  <div class="interactive-chart-head">
    <strong>Çarpıklık ve merkezi eğilim</strong>
    <span class="interactive-chart-hint">Kaydırıcıyı sürükle</span>
  </div>
  <label class="interactive-chart-control">
    <span>Çarpıklık: <b id="skewLabel">0.0</b> <small id="skewName">(simetrik)</small></span>
    <input id="skewSlider" type="range" min="-6" max="6" step="0.1" value="0">
  </label>
  <div class="interactive-chart-canvas-wrap">
    <canvas id="skewChart" height="280" aria-label="Çarpıklığa göre dağılım grafiği"></canvas>
  </div>
  <div class="interactive-chart-stats" id="skewStats">
    <div><span>Mod</span><strong id="statMode">0.00</strong></div>
    <div><span>Medyan</span><strong id="statMedian">0.00</strong></div>
    <div><span>Ortalama</span><strong id="statMean">0.00</strong></div>
  </div>
  <p class="interactive-chart-note" id="skewNote">Simetrik dağılım: üç ölçü de yaklaşık aynı noktada.</p>
</div>

<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<script src="/assets/charts/skew-demo.js" defer></script>

## Bu üç ölçü neyi anlatır?

### Mod
Eğrinin **zirve yaptığı** nokta; en sık görülen değer bölgesi.

### Medyan
Dağılımı iki eşit olasılık dilimine bölen nokta (ortadaki gözlem).

### Ortalama (beklenen değer)
Dağılımın “kütle merkezidir”. Uzun kuyruk ortalamayı kendi tarafına çeker.

## Neden çarpıklıkta ortalama kayar?

Sağa çarpık bir dağılımı düşün: çoğu değer solda toplanır (mod soldadır), ama sağdaki uzun kuyruk ortalamaı sağa çeker. Medyan ise ortalamaya göre daha dayanıklıdır; kuyruktan daha az etkilenir. Bu yüzden sıra genelde şöyle olur:

`mod → medyan → ortalama` (sağa çarpık)

Sola çarpıklıkta tersine döner.

## Ne zaman hangisini kullanmalı?

- **Simetrik / neredeyse normal:** ortalama rahatça kullanılır.  
- **Çarpık gelir, süre, fiyat verileri:** medyan daha dürüst bir özet olabilir.  
- **Kategorik / tepe noktası önemliyse:** moda bakılır.

## Küçük pratik not

Gerçek veride tek bir grafiğe bakıp “bu normal” demek yetmez; histogram + çarpıklık + ortalama-medyan farkı birlikte okunur. Bu yazıdaki grafik, o farkı sezgisel olarak hissettirmek içindir.

## Özet

| Dağılım | Sıra |
|---|---|
| Simetrik | ortalama ≈ medyan ≈ mod |
| Sağa çarpık | mod < medyan < ortalama |
| Sola çarpık | ortalama < medyan < mod |

Kaydırıcıyı birkaç kez oynatıp özellikle **kuyruğun ortalamayı nasıl çektiğini** izle; istatistikte en sık karıştırılan noktalardan biri budur.
