



```markdown
# Kubernetes & CI/CD Tabanlı Full-Stack İngilizce Öğrenme Platformu

**Ders:** Bulut Bilişim 
**Geliştirici:** Kadir Kerim Çakay  
**Öğrenci Numarası:** 2301031020  

---

## 🏗️ 1. Genel Sistem ve Ağ Mimarisi

Sistem, gevşek bağlı (loosely coupled) mikroservis mantığıyla tasarlanmış ve üç ana katmandan oluşmaktadır. Tüm sistem Google Kubernetes Engine (GKE) üzerinde 2 adet sanal makineden (Node) oluşan bir cluster içerisinde orkestre edilmektedir.


```

```
              [ KULLANICI / WEB TARAYICI ]
                           │
                           │ (HTTP Port: 80)
                           ▼
                ┌─────────────────────┐
                │  frontend-service   │ (LoadBalancer)
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │    frontend-app     │ (React + Nginx - Replicas: 2)
                └──────────┬──────────┘
                           │
                           │ (Internal API / Port: 5000)
                           ▼
                ┌─────────────────────┐
                │   backend-service   │ (ClusterIP)
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │     backend-app     │ (Node.js/Express - Replicas: 2)
                └──────────┬──────────┘
                           │
                           │ (PostgreSQL Port: 5432) [NetworkPolicy Korumalı]
                           ▼
                ┌─────────────────────┐
                │  postgres-service   │ (ClusterIP)
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │     postgres-db     │ (PostgreSQL - Replicas: 1)
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │ postgres-pvc (Disk) │ (Kalıcı Veri Katmanı)
                └─────────────────────┘

```

```

### Katman Detayları ve Network Akışı:
1. **Frontend Katmanı (React + Nginx):** Kullanıcı web tarayıcısından Google Cloud tarafından tahsis edilen `External-IP` adresine istek atar. Bu istek standart HTTP (80) portundan `frontend-service` (LoadBalancer) tarafından karşılanır ve arkadaki 2 adet frontend poduna dağıtılır. Konteyner içinde Nginx sunucusu statik dosyaları 3000 portundan servis eder.
2. **Backend Katmanı (Node.js/Express):** Arayüz üzerinden yapılan API istekleri, küme içerisindeki gizli `backend-service` (ClusterIP) nesnesine yönlendirilir. İstekler internal ağda 5000 portu üzerinden 2 adet backend poduna yük dengeli (Load Balanced) şekilde iletilir.
3. **Veri Tabanı Katmanı (PostgreSQL):** Backend podları, iş mantığı ve veri kaydı için `postgres-service` adresi üzerinden 5432 portunu kullanarak PostgreSQL poduna bağlanır. Bu katman dış dünyaya tamamen kapalıdır.

---

## 📦 2. Dockerizasyon Yapısı

Projedeki mikroservisler, minimum imaj boyutu ve maksimum güvenlik standartları gözetilerek Dockerize edilmiştir.

### Frontend (Multi-stage Build):
React uygulaması `node:20-alpine` imajı üzerinde derlenmiş, derleme sonucunda oluşan optimize edilmiş `dist` klasörü üretim (production) aşamasında hafif ve güvenli bir `nginx:alpine` imajına taşınmıştır. Nginx konfigürasyonunda Tek Sayfa Uygulamaları (SPA) için sayfa yenileme hatalarını engelleyen `try_files` yönlendirmesi ve internal backend servisine geçiş sağlayan `/api/` proxy blokları tanımlanmıştır.

### Backend:
Node.js/Express backend uygulaması, kütüphane bağımlılıkları optimize edilerek `node:20-alpine` tabanında paketlenmiş ve çevre değişkenleri (environment variables) Kubernetes katmanından enjekte edilecek şekilde tasarlanmıştır.

---

## ☸️ 3. Kubernetes Nesneleri (Manifests) ve Mühendislik Kararları

Projenin Kubernetes altyapısı `k8s/` klasörü altındaki bildirimsel (declarative) YAML dosyaları ile yönetilmektedir:

### Pod Ölçekleme ve Yüksek Erişilebilirlik (Deployment)
* Hem `backend-deployment` hem de `frontend-deployment` nesnelerinde **`replicas: 2`** kullanılmıştır.
* Kubernetes, bu kopyaları küme içerisindeki 2 farklı sanal makineye (Node) dengeli dağıtır. Makinelerden biri fiziksel olarak çökse dahi, sistem kesintisiz olarak diğer Node üzerindeki yedek podlar ile hizmet vermeye devam eder (High Availability).

### Servis Keşfi ve Yük Dengeleme (Service)
* **`frontend-service` (`type: LoadBalancer`):** Google Cloud altyapısından gerçek bir dış IP (External IP) talep ederek uygulamayı internete açar. Giriş portu dünya standardı olan 80 portuna sabitlenmiştir.
* **`backend-service` & `postgres-service` (`type: ClusterIP`):** Bu servisler dış dünyaya tamamen kapalıdır. Yalnızca küme içi (internal) DNS mekanizması ile erişilebilirdir. Böylece kritik iş mantığı ve veri tabanı ağ seviyesinde izole edilmiştir.

### Kalıcı Veri Katmanı (PersistentVolumeClaim)
* Konteynerların doğası gereği geçici (ephemeral) olan depolama yapısı, **`PersistentVolumeClaim (PVC)`** nesnesi ile kalıcı hale getirilmiştir. 
* Google Cloud'un standart blok depolama üniteleri (`ReadWriteOnce`) sisteme bağlanmıştır. PostgreSQL podu silinse veya yeniden başlasa bile kullanıcı verileri ve ilerlemeler sıfırlanmaz, diske kalıcı olarak yazılır.

---

## 🛡️ 4. Ağ Güvenliği (NetworkPolicy)

Projede sıfır güven (Zero Trust) network modeli uygulanmıştır. Kubernetes kümelerinde varsayılan olarak açık olan podlar arası serbest iletişim, **`NetworkPolicy`** nesnesi ile sınırlandırılmıştır.

* `db-security-policy` isimli politika ile `postgres-db` podunun etrafına sanal bir güvenlik duvarı (Firewall) örülmüştür.
* **Beyaz Liste (Allowlist)** mantığı kullanılarak, veri tabanına yalnızca sırtında `app: backend-app` etiketi (barkodu) olan podların 5432 portundan erişebileceği kuralı network katmanında katı bir şekilde tanımlanmıştır. Frontend podları veya yetkisiz diğer podlar doğrudan veri tabanına sızamaz.

---

## 🔄 5. Otomatik CI/CD Pipeline (Google Cloud Build)

Projenin yaşam döngüsünü otomatikleştirmek amacıyla tam entegre bir Sürekli Entegrasyon ve Sürekli Dağıtım (CI/CD) boru hattı kurulmuştur. Süreç, kök dizindeki `cloudbuild.yaml` dosyası ile yönetilir.


```

[ VS Code / Git Push ] ──> [ GitHub Repository ] ──> [ Cloud Build Trigger ]
│
┌──────────────────────────────────────────────────────────┘
▼
┌──────────────────────────────┐
│ Step 0 & 1: docker build     │ ──> Kod değişikliklerinden yeni imaj üretilir.
└──────────────┬───────────────┘
▼
┌──────────────────────────────┐
│ Step 2 & 3: docker push      │ ──> Yeni imajlar Google Container Registry'ye (GCR) atılır.
└──────────────┬───────────────┘
▼
┌──────────────────────────────┐
│ Step 4 & 5: kubectl set image│ ──> GKE Cluster'ına bağlanıp podlar sıfır kesintiyle güncellenir.
└──────────────────────────────┘

```

### Pipeline Güvenlik ve Optimizasyonları:
* **Benzersiz İmaj Sürümleri (`$SHORT_SHA`):** İmaj versiyonlamasında manuel isimler yerine GitHub commit'inin benzersiz 7 haneli kodu (SHA) basılır. Bu sayede her canlı imajın hangi kod değişikliğinden üretildiği geriye dönük takip edilebilir.
* **IAM Rol Yetkilendirmesi:** Cloud Build hizmet hesabına minimum yetki prensibiyle yalnızca `Kubernetes Engine Developer` rolü tanımlanarak küme üzerinde güvenli dağıtım yapması sağlanmıştır.
* **Güvenli Loglama:** `CLOUD_LOGGING_ONLY` opsiyonu ile derleme çıktıları harici disklere ihtiyaç duyulmadan güvenli bulut log sisteminde depolanır.

---

## 🛠️ 6. Karşılaşılan Sorunlar ve Mühendislik Çözümleri

### 1. PostgreSQL Podunun `Error` Durumuna Düşmesi
* **Sorun:** GKE üzerinde PVC diski bağlandığında, bulut sağlayıcısı diskin kök dizinine otomatik olarak `lost+found` sistem klasörünü eklemektedir. PostgreSQL mimarisi, ilk kurulumda veri klasörünün tamamen boş olmasını şart koştuğu için bu klasörü görünce çökmekteydi.
* **Çözüm:** `postgres-deployment.yaml` dosyası içinde **`subPath: postgres-data`** tanımı yapılmıştır. Diskin kök dizini yerine içerisinde izole ve tamamen boş bir alt klasör oluşturularak PostgreSQL'in bu temiz dizine yazması sağlanmış, sorun kalıcı olarak çözülmüştür.

### 2. React Sayfa Yenilemelerinde Boş Ekran (Blank Screen) Hatası
* **Sorun:** Canlı ortamda `/reading` veya `/vocab` gibi alt sayfalara doğrudan tıklandığında veya sayfa yenilendiğinde Nginx sunucusu bu yolları fiziksel bir klasör sandığı için HTTP 404/Boş ekran hatası veriyordu.
* **Çözüm:** Frontend Dockerfile içerisindeki Nginx konfigürasyonuna **`try_files $uri $uri/ /index.html;`** kuralı eklenmiştir. Böylece gelen tüm alt sayfa istekleri React Router'ın yönetebilmesi için ana `index.html` dosyasına yönlendirilmiştir.

---

## 💻 7. Projenin Ayağa Kaldırılması (Deployment Guide)

Bu projeyi bir bilgisayarda (gcloud CLI ve Docker kurulu ortamda) Google Cloud üzerinde yeniden ayağa kaldırmak veya mevcut kümeyi yönetmek için aşağıdaki adımlar izlenir:

### 1. Kimlik Doğrulama ve Küme Bağlantısı
```bash
# Google Cloud oturumu açma
gcloud auth login

# Hedef projeyi sabitleme
gcloud config set project ingilizce-ogrenme-projesi

# GKE Cluster yönetim yetkisini (Kubeconfig) yerel bilgisayara çekme
gcloud container clusters get-credentials english-cluster --zone us-central1-a

```

### 2. Projenin İndirilmesi ve Tek Komutla Dağıtım (One-Click Deploy)

```bash
# Kaynak kodların GitHub'dan çekilmesi
git clone https://github.com/KadirCakay/LearnEnglish.git
cd LearnEnglish/k8s

# Klasördeki tüm Kubernetes manifestolarının tek seferde cluster'a uygulanması
kubectl apply -f .

```


```
