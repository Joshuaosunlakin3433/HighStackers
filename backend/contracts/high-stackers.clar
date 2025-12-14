;; HighStackers - PvP Betting Arena on Stacks
;; 90/8/2 Payout Model: Winner 90%, Loser 8% (Restack Rebate), Platform 2%

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-lobby-not-found (err u101))
(define-constant err-lobby-already-exists (err u102))
(define-constant err-insufficient-amount (err u103))
(define-constant err-lobby-full (err u104))
(define-constant err-lobby-closed (err u105))
(define-constant err-invalid-multiplier (err u106))
(define-constant err-transfer-failed (err u107))
(define-constant err-cannot-join-own-lobby (err u108))

;; Minimum bet: 1 STX (in microSTX = 1,000,000)
(define-constant min-bet-amount u1000000)

;; Platform fee wallet - defaults to contract owner, can be updated via set-platform-wallet
(define-data-var platform-wallet principal contract-owner)

;; Lobby Status
(define-constant status-open u1)
(define-constant status-in-progress u2)
(define-constant status-closed u3)

;; Data Maps
(define-map lobbies
    { lobby-id: uint }
    {
        maker: principal,
        taker: (optional principal),
        amount: uint,
        target-multiplier: uint,
        status: uint,
        winner: (optional principal),
        created-at: uint
    }
)

;; Track lobby counter
(define-data-var lobby-counter uint u0)

;; Platform accumulated fees
(define-data-var platform-balance uint u0)

;; Read-only functions

(define-read-only (get-lobby (lobby-id uint))
    (map-get? lobbies { lobby-id: lobby-id })
)

(define-read-only (get-lobby-counter)
    (ok (var-get lobby-counter))
)

(define-read-only (get-platform-balance)
    (ok (var-get platform-balance))
)

(define-read-only (get-platform-wallet)
    (ok (var-get platform-wallet))
)

;; Public functions

;; Create a new lobby
(define-public (create-lobby (amount uint) (target-multiplier uint))
    (let
        (
            (new-lobby-id (+ (var-get lobby-counter) u1))
            (maker tx-sender)
        )
        ;; Validations
        (asserts! (>= amount min-bet-amount) err-insufficient-amount)
        (asserts! (and (>= target-multiplier u2) (<= target-multiplier u10)) err-invalid-multiplier)
        
        ;; Transfer STX from maker to contract
        (try! (stx-transfer? amount maker (as-contract tx-sender)))
        
        ;; Create lobby entry
        (map-set lobbies
            { lobby-id: new-lobby-id }
            {
                maker: maker,
                taker: none,
                amount: amount,
                target-multiplier: target-multiplier,
                status: status-open,
                winner: none,
                created-at: stacks-block-height
            }
        )
        
        ;; Increment counter
        (var-set lobby-counter new-lobby-id)
        
        (ok new-lobby-id)
    )
)

;; Join an existing lobby and trigger resolution
(define-public (join-lobby (lobby-id uint))
    (let
        (
            (lobby (unwrap! (map-get? lobbies { lobby-id: lobby-id }) err-lobby-not-found))
            (taker tx-sender)
            (maker (get maker lobby))
            (amount (get amount lobby))
            (lobby-status (get status lobby))
        )
        ;; Validations
        (asserts! (is-eq lobby-status status-open) err-lobby-full)
        (asserts! (not (is-eq taker maker)) err-cannot-join-own-lobby)
        
        ;; Transfer STX from taker to contract
        (try! (stx-transfer? amount taker (as-contract tx-sender)))
        
        ;; Update lobby to in-progress
        (map-set lobbies
            { lobby-id: lobby-id }
            (merge lobby { 
                taker: (some taker),
                status: status-in-progress
            })
        )
        
        ;; Resolve the game immediately (using VRF-like randomness)
        (try! (resolve-game lobby-id maker taker amount))
        
        (ok true)
    )
)

;; Internal: Resolve game and distribute payouts
(define-private (resolve-game (lobby-id uint) (maker principal) (taker principal) (amount uint))
    (let
        (
            (total-pot (* amount u2))
            ;; WARNING - MVP RANDOMNESS: Using lobby-id + block-height for demo purposes
            ;; NOTE: This is predictable and manipulable - DO NOT use in production
            ;; Production version should use Stacks VRF or Chainlink VRF
            (pseudo-random (+ lobby-id stacks-block-height))
            (winner-is-maker (is-eq (mod pseudo-random u2) u0))
            (winner (if winner-is-maker maker taker))
            (loser (if winner-is-maker taker maker))
            
            ;; Calculate payouts (90/8/2)
            ;; Using integer division, dust goes to platform
            (winner-amount (/ (* total-pot u90) u100))
            (loser-amount (/ (* total-pot u8) u100))
            (platform-fee (- total-pot (+ winner-amount loser-amount)))
        )
        
        ;; Transfer winner payout
        (unwrap! (as-contract (stx-transfer? winner-amount tx-sender winner)) err-transfer-failed)
        
        ;; Transfer loser rebate (Restack Rebate!)
        (unwrap! (as-contract (stx-transfer? loser-amount tx-sender loser)) err-transfer-failed)
        
        ;; Accumulate platform fee
        (var-set platform-balance (+ (var-get platform-balance) platform-fee))
        
        ;; Update lobby status
        (map-set lobbies
            { lobby-id: lobby-id }
            {
                maker: maker,
                taker: (some taker),
                amount: amount,
                target-multiplier: u0,
                status: status-closed,
                winner: (some winner),
                created-at: (unwrap-panic (get created-at (map-get? lobbies { lobby-id: lobby-id })))
            }
        )
        
        (ok winner)
    )
)

;; Admin: Withdraw platform fees
(define-public (withdraw-platform-fees)
    (let
        (
            (balance (var-get platform-balance))
            (recipient (var-get platform-wallet))
        )
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (asserts! (> balance u0) err-insufficient-amount)
        
        ;; Transfer accumulated fees
        (try! (as-contract (stx-transfer? balance tx-sender recipient)))
        
        ;; Reset balance
        (var-set platform-balance u0)
        
        (ok balance)
    )
)

;; Admin: Update platform wallet
(define-public (set-platform-wallet (new-wallet principal))
    (begin
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (var-set platform-wallet new-wallet)
        (ok true)
    )
)

;; Helper to convert single byte buffer to uint
(define-private (buff-to-uint (byte (buff 1)))
    (unwrap-panic (index-of? 0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff byte))
)
