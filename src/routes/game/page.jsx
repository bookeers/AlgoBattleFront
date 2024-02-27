import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "./game.css";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import socket from "~/lib/sockets/socket";
import { Col, Button } from "react-bootstrap";

export default function GamePage() {
  const [cards, setCards] = useState([]);
  const [condition, setCondition] = useState(false);
  const { state } = useLocation();
  const probNum = state?.probNum || 1000;
  const randomProblem = state?.randomProblem || "A+B";
  const qTier = state?.qTier || 1; // 오류 방지용 기본값
  const user1Name = state?.user1Name;
  const user2Name = state?.user2Name;
  const user1Tier = state?.user1Tier;
  const user2Tier = state?.user2Tier;
  const { handle } = useSelector((state) => state.user.user);
  const { roomId } = useParams();
  const [time, setTime] = useState(() => {
    const savedTime = sessionStorage.getItem("timer");
    return savedTime ? Number(savedTime) : 60 * 60;
  });

  const navigate = useNavigate();

  const getBackgroundColor = (condition) => {
    return condition ? "#99ccff" : "hsl(336, 100%, 80%)";
  };
  const addCard = async (e) => {
    e.preventDefault();
    const encodedUser1Name = encodeURIComponent(user1Name);
    const encodedUser2Name = encodeURIComponent(user2Name);
    const userName = handle === user1Name ? encodedUser1Name : encodedUser2Name;

    try {
      const response = await fetch(
        `http://localhost:3000/api/users/${userName}/solvedStatus`
      );

      if (!response.ok) {
        throw new Error(`채점에 오류가 발생했어요`);
      }

      const data = await response.json();
      const result = data.result;

      setCondition((prevCondition) => result === "맞았습니다");

      const newCard = {
        userid: userName,
        condition: result === "맞았습니다",
        solved:
          result === "맞았습니다"
            ? `${probNum}번 문제 맞았음`
            : `${probNum}번 문제 틀렸음`,
        tierinfo: handle === user1Name ? `${user1Tier}` : `${user2Tier}`,
      };

      const maxCards = 4;

      setCards((prevCards) => {
        let updatedCards = [...prevCards];

        if (updatedCards.length >= maxCards) {
          updatedCards = updatedCards.slice(1);
        }

        updatedCards.push(newCard);

        // 내가 채점을 하고 상대방에게 내 배열도 보내주고
        socket.emit("updatedCard", { updatedCards, roomId });

        return updatedCards;
        // 1. emit으로 우리가 푼거를 전송을 하고 return
        // 2. on으로 상대가 보낸거를 받고 그 배열을 return
      });
    } catch (error) {
      console.error("Error:", error.message);
    }
  };

  socket.on("updatedCard", (data) => {
    // data가 상대가 보낸 배열
    setCards(data);
  });

  useEffect(() => {
    const lastCard = cards[cards.length - 1];
    if (lastCard && lastCard.condition) {
      setTimeout(async () => {
        const winner = lastCard.userid === user1Name ? 1 : 2;
        try {
          const response = await fetch(
            `http://localhost:3000/api/users/${lastCard.userid}`,
            {
              method: "POST",
            }
          );

          if (!response.ok) {
            throw new Error(`사용자 정보 업데이트에 오류가 발생했어요`);
          }

          const updatedUserData = await response.json();

          // 1. 게임 끝났으니까 게임이 끝났다는 거를 상대에게 보냄
          // 2. 내 쪽에서는 밑에거 그래도 실행
          // 3. 상대도 끝났다는 것을 받으면 밑에거 그대로 실행

          // 1. 상대에게 끝났다는 거를 보냄
          socket.emit("finishGame", { winner, roomId });
        } catch (error) {
          console.error("Error:", error.message);
        }
      }, 300);
    }
  }, [cards]);

  socket.on("finishGame", (winner) => {
    alert("문제를 푼 플레이어가 있어 게임이 끝났습니다!");
    sessionStorage.removeItem("timer");
    navigate(`/room/${roomId}/result`, {
      state: {
        user1Name,
        user2Name,
        user1Tier,
        user2Tier,
        winner,
      },
    });
  });

  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const rotationIntervalId = setInterval(() => {
      setRotation((prevRotation) => (prevRotation + 1) % 360);
    }, 50);

    const timerID = setInterval(() => {
      setTime((prevTime) => {
        if (prevTime === 0) {
          alert("시간이 지나 게임이 끝났습니다");
          clearInterval(timerID);
          sessionStorage.removeItem("timer");
          navigate("/");
        } else {
          const nextTime = prevTime - 1;
          sessionStorage.setItem("timer", nextTime);
          return nextTime;
        }
      });
    }, 1000);

    return () => {
      clearInterval(rotationIntervalId);
      clearInterval(timerID);
    };
  }, [time, navigate]);

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
      2,
      "0"
    )}`;
  };
  const handleBack = () => {
    // TODO: 플레이어 나갔을때 나갔는지 판정 + 승패계산+ 나간놈은 로비로 안나간놈은 결과창으로
    navigate("/");
  };

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-lg-8 game-container">
          <img
            src="/src/assets/imgs/sample_logo_transparent.png"
            alt="Rotating"
            className="rotating-image"
            style={{
              transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
            }}
          />
          <p>문제의 아무 영역이나 누르면 문제풀기 창으로 이동해요!</p>
          <p>채점하기를 누르면 채점이 가능합니다</p>

          <div className="timer-container">
            <span className="timer-icon">⏰</span>
            <span className="timer-time">{formatTime(time)}</span>
          </div>

          <div className="task-details">
            <a
              href={`https://www.acmicpc.net/problem/${probNum}`}
              target="_blank"
              rel="noopener noreferrer"
              className="noDecoration"
            >
              <div className="task-card">
                <div className="task-number">
                  <img
                    src={`https://d2gd6pc034wcta.cloudfront.net/tier/${qTier}.svg`}
                    alt="Icon"
                    className="icon-image"
                  />
                  {randomProblem}
                </div>
                <div className="task-buttons">
                  <button
                    className="task-button default"
                    onClick={(e) => addCard(e)} // TODO add카드 안에 채점 알고리즘을 추가
                  >
                    채점하기
                  </button>
                </div>
              </div>
            </a>
          </div>
          <Col className="d-flex justify-content-start">
            <Button className="backBtn" onClick={handleBack}>
              나가기
            </Button>
          </Col>
        </div>

        <div className="col-lg-4">
          {cards.map((card, index) => (
            <div key={index} className="card mb-3">
              <div
                className="card-body"
                style={{ backgroundColor: getBackgroundColor(card.condition) }}
              >
                <img
                  src={`https://d2gd6pc034wcta.cloudfront.net/tier/${card.tierinfo}.svg`} //TODO user 정보 받아와줘야함
                  alt={`err`}
                  className="user-image"
                  style={{
                    backgroundColor: getBackgroundColor(card.condition),
                  }}
                />
                <h5
                  className="card-title"
                  style={{
                    backgroundColor: getBackgroundColor(card.condition),
                  }}
                >
                  {card.userid}
                </h5>
                <div
                  className="d-flex justify-content-between align-items-center"
                  style={{
                    backgroundColor: getBackgroundColor(card.condition),
                  }}
                >
                  <div
                    className="card-text h3"
                    style={{
                      backgroundColor: getBackgroundColor(card.condition),
                    }}
                  >
                    {card.solved}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
